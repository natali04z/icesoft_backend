import Sale from '../models/sales.js';
import Product from '../models/product.js';
import Customer from '../models/customer.js';
import mongoose from 'mongoose';
import { checkPermission } from '../utils/permissions.js';
import PDFDocument from 'pdfkit';
import Excel from 'exceljs';
import fs from 'fs';
import path from 'path';

// Función para generar ID de venta automáticamente
async function generateSaleId() {
    try {
        const lastSale = await Sale.findOne().sort({ createdAt: -1 });
        
        // Si no hay venta previa o el formato no coincide, comenzar desde 01
        if (!lastSale || !/^Sa\d{2}$/.test(lastSale.id)) {
            return "Sa01";
        }

        // Extraer el número, incrementarlo y formatearlo
        const lastNumber = parseInt(lastSale.id.substring(2), 10);
        const nextNumber = (lastNumber + 1).toString().padStart(2, "0");
        return `Sa${nextNumber}`;
    } catch (error) {
        console.error("Error generating sale ID:", error);
        // En caso de error, devolver un valor por defecto
        return "Sa01";
    }
}

// Función para generar ID de factura automáticamente
async function generateInvoiceId() {
    try {
        const lastInvoice = await Sale.findOne({ invoiceID: { $exists: true, $ne: null } })
            .sort({ invoiceID: -1 });
        
        // Si no hay factura previa o el formato no coincide, comenzar desde 001
        if (!lastInvoice || !/^Inv\d{3}$/.test(lastInvoice.invoiceID)) {
            return "Inv001";
        }

        // Extraer el número, incrementarlo y formatearlo
        const lastNumber = parseInt(lastInvoice.invoiceID.substring(3), 10);
        const nextNumber = (lastNumber + 1).toString().padStart(3, "0");
        return `Inv${nextNumber}`;
    } catch (error) {
        console.error("Error generating invoice ID:", error);
        // En caso de error, devolver un valor por defecto
        return "Inv001";
    }
}

// Formatear fecha para mostrar
const formatDate = (date) => {
  if (!date) return null;
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return "Invalid Date";
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (error) {
    console.error("Error formatting date:", error);
    return "Error";
  }
};

// Obtener todas las ventas
export const getSales = async (req, res) => {
    try {
        if (!checkPermission(req.user.role, "view_sales")) {
            return res.status(403).json({ message: "Unauthorized access" });
        }

        const sales = await Sale.find()
            .populate("customer", "name lastname")
            .populate("product", "name price");

        // Formatear respuesta con manejo seguro de null/undefined
        const formattedSales = sales.map(sale => ({
            id: sale.id || '',
            invoiceID: sale.invoiceID || null,
            customer: sale.customer ? `${sale.customer.name || ''} ${sale.customer.lastname || ''}` : 'Unknown Customer',
            customerId: sale.customer ? sale.customer._id : null,
            product: sale.product ? sale.product.name : 'Unknown Product',
            productId: sale.product ? sale.product._id : null,
            date: formatDate(sale.date),
            price: sale.price || 0,
            quantity: sale.quantity || 0,
            total: sale.total || 0
        }));

        res.status(200).json(formattedSales);
    } catch (error) {
        console.error("Error fetching sales:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// Obtener venta por ID
export const getSaleById = async (req, res) => {
    try {
        if (!checkPermission(req.user.role, "view_sales_id")) {
            return res.status(403).json({ message: "Unauthorized access" });
        }

        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid sale ID format" });
        }

        const sale = await Sale.findById(id)
            .populate("customer", "name lastname email phone")
            .populate("product", "name price");

        if (!sale) {
            return res.status(404).json({ message: "Sale not found" });
        }

        // Formatear respuesta con manejo seguro de null/undefined
        const formattedSale = {
            id: sale.id || '',
            invoiceID: sale.invoiceID || null,
            customer: sale.customer ? {
                id: sale.customer._id,
                name: sale.customer.name || '',
                lastname: sale.customer.lastname || '',
                email: sale.customer.email || '',
                phone: sale.customer.phone || ''
            } : { id: null, name: 'Unknown', lastname: '', email: '', phone: '' },
            product: sale.product ? {
                id: sale.product._id,
                name: sale.product.name || '',
                price: sale.product.price || 0
            } : { id: null, name: 'Unknown Product', price: 0 },
            date: formatDate(sale.date),
            price: sale.price || 0,
            quantity: sale.quantity || 0,
            total: sale.total || 0
        };

        res.status(200).json(formattedSale);
    } catch (error) {
        console.error("Error fetching sale:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// Crear una nueva venta
export const createSale = async (req, res) => {
    try {
        if (!checkPermission(req.user.role, "create_sales")) {
            return res.status(403).json({ message: "Unauthorized access" });
        }

        const { customer, product, quantity, price, date, createInvoice } = req.body;

        // Validar datos
        if (!customer || !product || !quantity || !price) {
            return res.status(400).json({ message: "Customer, product, quantity and price are required" });
        }

        if (!mongoose.Types.ObjectId.isValid(customer)) {
            return res.status(400).json({ message: "Invalid customer ID" });
        }

        if (!mongoose.Types.ObjectId.isValid(product)) {
            return res.status(400).json({ message: "Invalid product ID" });
        }

        // Verificar que el cliente existe
        const customerExists = await Customer.findById(customer);
        if (!customerExists) {
            return res.status(404).json({ message: "Customer not found" });
        }

        // Verificar que el producto existe y tiene stock
        const productData = await Product.findById(product);
        if (!productData) {
            return res.status(404).json({ message: "Product not found" });
        }

        if (productData.stock < quantity) {
            return res.status(400).json({ message: "Not enough stock available" });
        }

        // Generar ID para la venta
        const saleId = await generateSaleId();
        
        // Generar ID de factura si se solicita
        let invoiceID = null;
        if (createInvoice) {
            invoiceID = await generateInvoiceId();
        }

        // Crear nueva venta
        const newSale = new Sale({
            id: saleId,
            invoiceID,
            customer,
            product,
            date: date || new Date(),
            price,
            quantity,
            total: price * quantity
        });

        // Reducir stock del producto
        productData.stock -= quantity;
        await productData.save();

        // Guardar la venta
        await newSale.save();

        // Formatear respuesta
        const savedSale = await Sale.findById(newSale._id)
            .populate("customer", "name lastname")
            .populate("product", "name");

        // Formatear con manejo seguro de null/undefined
        const formattedSale = {
            id: savedSale.id || '',
            invoiceID: savedSale.invoiceID || null,
            customer: savedSale.customer 
                ? `${savedSale.customer.name || ''} ${savedSale.customer.lastname || ''}` 
                : 'Unknown Customer',
            customerId: savedSale.customer ? savedSale.customer._id : null,
            product: savedSale.product ? savedSale.product.name : 'Unknown Product',
            productId: savedSale.product ? savedSale.product._id : null,
            date: formatDate(savedSale.date),
            price: savedSale.price || 0,
            quantity: savedSale.quantity || 0,
            total: savedSale.total || 0
        };

        res.status(201).json({ 
            message: "Sale created successfully", 
            sale: formattedSale 
        });
    } catch (error) {
        console.error("Error creating sale:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// Actualizar una venta
export const updateSale = async (req, res) => {
    try {
        if (!checkPermission(req.user.role, "update_sales")) {
            return res.status(403).json({ message: "Unauthorized access" });
        }

        const { id } = req.params;
        const { customer, product, quantity, price, date, invoiceID } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid sale ID format" });
        }

        // Buscar la venta existente
        const sale = await Sale.findById(id);
        if (!sale) {
            return res.status(404).json({ message: "Sale not found" });
        }

        // Verificar cambios en el producto o cantidad para ajustar el stock
        let stockAdjustment = 0;
        let newProductId = sale.product;

        // Si cambia el producto
        if (product && product !== sale.product.toString()) {
            if (!mongoose.Types.ObjectId.isValid(product)) {
                return res.status(400).json({ message: "Invalid product ID" });
            }

            // Verificar que el nuevo producto existe
            const newProduct = await Product.findById(product);
            if (!newProduct) {
                return res.status(404).json({ message: "New product not found" });
            }

            // Devolver stock al producto anterior
            const oldProduct = await Product.findById(sale.product);
            if (oldProduct) {
                oldProduct.stock += sale.quantity;
                await oldProduct.save();
            }

            // Reducir stock del nuevo producto
            const quantityToUse = quantity !== undefined ? quantity : sale.quantity;
            if (newProduct.stock < quantityToUse) {
                return res.status(400).json({ message: "Not enough stock in new product" });
            }

            newProduct.stock -= quantityToUse;
            await newProduct.save();
            newProductId = newProduct._id;
        } 
        // Si solo cambia la cantidad
        else if (quantity !== undefined && quantity !== sale.quantity) {
            stockAdjustment = sale.quantity - quantity;
            
            const currentProduct = await Product.findById(sale.product);
            if (!currentProduct) {
                return res.status(404).json({ message: "Product not found" });
            }

            if (stockAdjustment < 0 && currentProduct.stock < Math.abs(stockAdjustment)) {
                return res.status(400).json({ message: "Not enough stock available" });
            }

            currentProduct.stock += stockAdjustment;
            await currentProduct.save();
        }

        // Verificar cliente si se proporciona
        if (customer && !mongoose.Types.ObjectId.isValid(customer)) {
            return res.status(400).json({ message: "Invalid customer ID" });
        }

        // Calcular nuevo total
        const newPrice = price !== undefined ? price : sale.price;
        const newQuantity = quantity !== undefined ? quantity : sale.quantity;
        const newTotal = newPrice * newQuantity;

        // Actualizar venta
        const updatedSale = await Sale.findByIdAndUpdate(
            id,
            {
                customer: customer || sale.customer,
                product: newProductId,
                quantity: newQuantity,
                price: newPrice,
                total: newTotal,
                date: date || sale.date,
                invoiceID: invoiceID !== undefined ? invoiceID : sale.invoiceID
            },
            { new: true, runValidators: true }
        )
        .populate("customer", "name lastname")
        .populate("product", "name");

        // Formatear respuesta con manejo seguro de null/undefined
        const formattedSale = {
            id: updatedSale.id || '',
            invoiceID: updatedSale.invoiceID || null,
            customer: updatedSale.customer 
                ? `${updatedSale.customer.name || ''} ${updatedSale.customer.lastname || ''}` 
                : 'Unknown Customer',
            customerId: updatedSale.customer ? updatedSale.customer._id : null,
            product: updatedSale.product ? updatedSale.product.name : 'Unknown Product',
            productId: updatedSale.product ? updatedSale.product._id : null,
            date: formatDate(updatedSale.date),
            price: updatedSale.price || 0,
            quantity: updatedSale.quantity || 0,
            total: updatedSale.total || 0
        };

        res.status(200).json({ 
            message: "Sale updated successfully", 
            sale: formattedSale 
        });
    } catch (error) {
        console.error("Error updating sale:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// Eliminar una venta
export const deleteSale = async (req, res) => {
    try {
        if (!checkPermission(req.user.role, "delete_sales")) {
            return res.status(403).json({ message: "Unauthorized access" });
        }

        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid sale ID format" });
        }

        // Buscar la venta para obtener datos del producto
        const sale = await Sale.findById(id);
        if (!sale) {
            return res.status(404).json({ message: "Sale not found" });
        }

        // Devolver stock al producto
        if (sale.product) {
            const product = await Product.findById(sale.product);
            if (product) {
                product.stock += sale.quantity;
                await product.save();
            }
        }

        // Eliminar la venta
        await Sale.findByIdAndDelete(id);

        res.status(200).json({ message: "Sale deleted successfully" });
    } catch (error) {
        console.error("Error deleting sale:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// Exportar ventas a PDF
export const exportSalesToPDF = async (req, res) => {
    try {
        if (!checkPermission(req.user.role, "export_sales")) {
            return res.status(403).json({ message: "Unauthorized access" });
        }

        const { startDate, endDate } = req.query;

        // Construir filtro de fechas si se proporcionan
        let dateFilter = {};
        if (startDate && endDate) {
            dateFilter = {
                date: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                }
            };
        }

        // Obtener ventas con filtro
        const sales = await Sale.find(dateFilter)
            .populate("customer", "name lastname")
            .populate("product", "name price")
            .sort({ date: -1 });

        if (sales.length === 0) {
            return res.status(404).json({ message: "No sales found for the specified period" });
        }

        // Crear documento PDF
        const doc = new PDFDocument({ margin: 50 });
        
        // Configurar encabezados para descarga del archivo
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=sales_report_${Date.now()}.pdf`);
        
        // Pipe PDF a la respuesta
        doc.pipe(res);

        // Estilo del documento
        doc.fontSize(20).text('Sales Report', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`Generated: ${new Date().toLocaleDateString()}`, { align: 'center' });
        doc.moveDown();

        // Filtros aplicados
        if (startDate && endDate) {
            doc.fontSize(12).text(`Period: ${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`, { align: 'center' });
            doc.moveDown();
        }

        // Tabla de ventas
        doc.moveDown();
        const tableTop = 150;
        const tableHeaders = ['ID', 'Invoice', 'Date', 'Customer', 'Product', 'Quantity', 'Price', 'Total'];
        const tableColumnWidths = [30, 40, 60, 100, 100, 50, 60, 60];
        
        // Encabezados de tabla
        let position = 0;
        doc.fontSize(10);
        
        tableHeaders.forEach((header, i) => {
            doc.text(header, position + 50, tableTop, { width: tableColumnWidths[i], align: 'left' });
            position += tableColumnWidths[i];
        });

        // Línea debajo de encabezados
        doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();
        
        // Contenido de tabla
        let tableRow = 0;
        let totalSales = 0;
        
        sales.forEach((sale, i) => {
            const y = tableTop + 25 + (tableRow * 20);
            
            // Si la página se llena, crear nueva página
            if (y > 700) {
                doc.addPage();
                tableRow = 0;
                doc.text('Sales Report (Continued)', 50, 50, { align: 'center' });
                doc.moveTo(50, 70).lineTo(550, 70).stroke();
                
                // Reescribir encabezados
                position = 0;
                tableHeaders.forEach((header, i) => {
                    doc.text(header, position + 50, 90, { width: tableColumnWidths[i], align: 'left' });
                    position += tableColumnWidths[i];
                });
                doc.moveTo(50, 105).lineTo(550, 105).stroke();
            }
            
            const rowY = tableTop + 25 + (tableRow * 20);
            position = 0;
            
            // Escribir datos de venta con manejo seguro de null/undefined
            doc.text(sale.id ? sale.id.toString() : '', position + 50, rowY, { width: tableColumnWidths[0], align: 'left' });
            position += tableColumnWidths[0];
            
            doc.text(sale.invoiceID ? sale.invoiceID.toString() : '-', position + 50, rowY, { width: tableColumnWidths[1], align: 'left' });
            position += tableColumnWidths[1];
            
            doc.text(formatDate(sale.date) || '-', position + 50, rowY, { width: tableColumnWidths[2], align: 'left' });
            position += tableColumnWidths[2];
            
            doc.text(sale.customer ? `${sale.customer.name || ''} ${sale.customer.lastname || ''}` : 'Unknown', position + 50, rowY, { width: tableColumnWidths[3], align: 'left' });
            position += tableColumnWidths[3];
            
            doc.text(sale.product ? sale.product.name || 'Unknown' : 'Unknown', position + 50, rowY, { width: tableColumnWidths[4], align: 'left' });
            position += tableColumnWidths[4];
            
            doc.text(sale.quantity ? sale.quantity.toString() : '0', position + 50, rowY, { width: tableColumnWidths[5], align: 'left' });
            position += tableColumnWidths[5];
            
            doc.text(`$${sale.price ? sale.price.toFixed(2) : '0.00'}`, position + 50, rowY, { width: tableColumnWidths[6], align: 'left' });
            position += tableColumnWidths[6];
            
            doc.text(`$${sale.total ? sale.total.toFixed(2) : '0.00'}`, position + 50, rowY, { width: tableColumnWidths[7], align: 'left' });
            
            totalSales += sale.total || 0;
            tableRow++;
        });

        // Total de ventas
        doc.moveDown(2);
        doc.fontSize(12).text(`Total Sales: $${totalSales.toFixed(2)}`, { align: 'right' });

        // Finalizar PDF
        doc.end();
    } catch (error) {
        console.error("Error exporting sales to PDF:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// Exportar ventas a Excel
export const exportSalesToExcel = async (req, res) => {
    try {
        if (!checkPermission(req.user.role, "export_sales")) {
            return res.status(403).json({ message: "Unauthorized access" });
        }

        const { startDate, endDate } = req.query;

        // Construir filtro de fechas si se proporcionan
        let dateFilter = {};
        if (startDate && endDate) {
            dateFilter = {
                date: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                }
            };
        }

        // Obtener ventas con filtro
        const sales = await Sale.find(dateFilter)
            .populate("customer", "name lastname")
            .populate("product", "name price")
            .sort({ date: -1 });

        if (sales.length === 0) {
            return res.status(404).json({ message: "No sales found for the specified period" });
        }

        // Crear libro Excel
        const workbook = new Excel.Workbook();
        const worksheet = workbook.addWorksheet('Sales Report');

        // Estilo para encabezados
        const headerStyle = {
            font: { bold: true, color: { argb: 'FFFFFFFF' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } },
            border: {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            }
        };

        // Añadir encabezados
        worksheet.columns = [
            { header: 'Sale ID', key: 'id', width: 10 },
            { header: 'Invoice ID', key: 'invoiceID', width: 12 },
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Customer', key: 'customer', width: 25 },
            { header: 'Product', key: 'product', width: 25 },
            { header: 'Quantity', key: 'quantity', width: 10 },
            { header: 'Price', key: 'price', width: 12 },
            { header: 'Total', key: 'total', width: 12 }
        ];

        // Estilo de encabezados
        worksheet.getRow(1).eachCell((cell) => {
            cell.fill = headerStyle.fill;
            cell.font = headerStyle.font;
            cell.border = headerStyle.border;
        });

        // Añadir datos con manejo seguro de null/undefined
        sales.forEach(sale => {
            worksheet.addRow({
                id: sale.id || '',
                invoiceID: sale.invoiceID || '-',
                date: formatDate(sale.date) || '-',
                customer: sale.customer ? `${sale.customer.name || ''} ${sale.customer.lastname || ''}` : 'Unknown',
                product: sale.product ? sale.product.name || 'Unknown' : 'Unknown',
                quantity: sale.quantity || 0,
                price: sale.price || 0,
                total: sale.total || 0
            });
        });

        // Formato para columnas numéricas
        worksheet.getColumn('price').numFmt = '$#,##0.00';
        worksheet.getColumn('total').numFmt = '$#,##0.00';

        // Añadir fila de total
        const totalRow = worksheet.rowCount + 2;
        worksheet.mergeCells(`A${totalRow}:G${totalRow}`);
        worksheet.getCell(`A${totalRow}`).value = 'Total Sales:';
        worksheet.getCell(`A${totalRow}`).alignment = { horizontal: 'right' };
        worksheet.getCell(`A${totalRow}`).font = { bold: true };
        
        worksheet.getCell(`H${totalRow}`).value = sales.reduce((sum, sale) => sum + (sale.total || 0), 0);
        worksheet.getCell(`H${totalRow}`).numFmt = '$#,##0.00';
        worksheet.getCell(`H${totalRow}`).font = { bold: true };

        // Configurar encabezados para descarga del archivo
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=sales_report_${Date.now()}.xlsx`);

        // Enviar Excel como respuesta
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error("Error exporting sales to Excel:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// Generar factura para una venta
export const generateInvoice = async (req, res) => {
    try {
        if (!checkPermission(req.user.role, "generate_invoice")) {
            return res.status(403).json({ message: "Unauthorized access" });
        }

        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid sale ID format" });
        }

        // Buscar la venta
        const sale = await Sale.findById(id)
            .populate("customer", "name lastname email phone")
            .populate("product", "name price");

        if (!sale) {
            return res.status(404).json({ message: "Sale not found" });
        }

        // Si la venta ya tiene factura, devolver error o la factura existente
        if (sale.invoiceID) {
            return res.status(409).json({ 
                message: "Invoice already exists for this sale", 
                invoiceID: sale.invoiceID 
            });
        }

        // Generar ID de factura
        const invoiceID = await generateInvoiceId();

        // Actualizar venta con ID de factura
        sale.invoiceID = invoiceID;
        await sale.save();

        // Crear PDF de factura
        const doc = new PDFDocument({ margin: 50 });

        // Configurar encabezados para descarga del archivo
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=invoice_${invoiceID}.pdf`);
        
        // Pipe PDF a la respuesta
        doc.pipe(res);

        // Estilo del documento
        doc.fontSize(20).text('INVOICE', { align: 'center' });
        doc.moveDown();

        // Información de la factura
        doc.fontSize(12).text(`Invoice #: ${invoiceID}`, { align: 'right' });
        doc.fontSize(12).text(`Date: ${formatDate(sale.date) || new Date().toLocaleDateString()}`, { align: 'right' });
        doc.moveDown();

        // Información del cliente con manejo seguro de null/undefined
        doc.fontSize(14).text('Customer Information');
        doc.fontSize(10).text(`Name: ${sale.customer ? `${sale.customer.name || ''} ${sale.customer.lastname || ''}` : 'Unknown Customer'}`);
        doc.fontSize(10).text(`Email: ${sale.customer && sale.customer.email ? sale.customer.email : 'N/A'}`);
        doc.fontSize(10).text(`Phone: ${sale.customer && sale.customer.phone ? sale.customer.phone : 'N/A'}`);
        doc.moveDown();

        // Detalle de compra
        doc.fontSize(14).text('Purchase Details');
        doc.moveDown();

        // Tabla de productos
        const tableTop = 250;
        const tableHeaders = ['Product', 'Quantity', 'Unit Price', 'Total'];
        const tableColumnWidths = [250, 70, 100, 100];
        
        // Encabezados de tabla
        let position = 0;
        doc.fontSize(10);
        
        tableHeaders.forEach((header, i) => {
            doc.text(header, position + 50, tableTop, { width: tableColumnWidths[i], align: 'left' });
            position += tableColumnWidths[i];
        });

        // Línea debajo de encabezados
        doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();
        
        // Contenido de tabla con manejo seguro de null/undefined
        const rowY = tableTop + 25;
        position = 0;
        
        doc.text(sale.product ? sale.product.name || 'Unknown Product' : 'Unknown Product', position + 50, rowY, { width: tableColumnWidths[0], align: 'left' });
        position += tableColumnWidths[0];
        doc.text(sale.quantity ? sale.quantity.toString() : '0', position + 50, rowY, { width: tableColumnWidths[1], align: 'left' });
        position += tableColumnWidths[1];
        
        doc.text(`$${sale.price ? sale.price.toFixed(2) : '0.00'}`, position + 50, rowY, { width: tableColumnWidths[2], align: 'left' });
        position += tableColumnWidths[2];
        
        doc.text(`$${sale.total ? sale.total.toFixed(2) : '0.00'}`, position + 50, rowY, { width: tableColumnWidths[3], align: 'left' });
        
        // Línea debajo de datos
        doc.moveTo(50, rowY + 20).lineTo(550, rowY + 20).stroke();
        
        // Total
        doc.moveDown(3);
        doc.fontSize(12).text(`Total: $${sale.total ? sale.total.toFixed(2) : '0.00'}`, { align: 'right' });

        // Términos y condiciones
        doc.moveDown(3);
        doc.fontSize(10).text('Terms and Conditions', { underline: true });
        doc.fontSize(8).text('This invoice is a legal document and proof of purchase. Payment terms as agreed.');

        // Footer
        doc.fontSize(8).text('Thank you for your business!', 50, 700, { align: 'center' });

        // Finalizar PDF
        doc.end();
    } catch (error) {
        console.error("Error generating invoice:", error);
        res.status(500).json({ message: "Server error" });
    }
};