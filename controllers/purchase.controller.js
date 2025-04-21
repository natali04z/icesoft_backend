import mongoose from "mongoose";
import Purchase from "../models/purchase.js";
import Product from "../models/product.js";
import { checkPermission } from "../utils/permissions.js";
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";

// Function to generate purchase ID
async function generatePurchaseId() {
    const lastPurchase = await Purchase.findOne().sort({ createdAt: -1 });
    if (!lastPurchase || !/^Pu\d{2}$/.test(lastPurchase.id)) {
        return "Pu01";
    }

    const lastNumber = parseInt(lastPurchase.id.substring(2), 10);
    const nextNumber = (lastNumber + 1).toString().padStart(2, "0");
    return `Pu${nextNumber}`;
}

// Validate purchase data
function validatePurchaseData(data, isUpdate = false) {
    const errors = [];
    
    // Only validate required fields if it's not an update
    if (!isUpdate) {
        if (!data.product) errors.push("Product is required");
        if (data.total === undefined) errors.push("Total is required");
        if (!data.details) errors.push("Details are required");
    }
    
    // Validate product ID if provided
    if (data.product && !mongoose.Types.ObjectId.isValid(data.product)) {
        errors.push("Invalid product ID format");
    }
    
    // Validate numeric fields
    if (data.total !== undefined) {
        if (typeof data.total !== "number") {
            errors.push("Total must be a number");
        } else if (data.total <= 0) {
            errors.push("Total must be a positive number");
        }
    }
    
    // Validate date if provided
    if (data.purchaseDate !== undefined) {
        const dateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z)?$/;
        if (!dateRegex.test(data.purchaseDate) && !(data.purchaseDate instanceof Date)) {
            errors.push("Invalid date format. Use YYYY-MM-DD or ISO format");
        }
    }
    
    // Validate string fields
    if (data.details !== undefined && (typeof data.details !== "string" || data.details.trim() === "")) {
        errors.push("Details must be a non-empty string");
    }
    
    return errors;
}

// GET: Retrieve all purchases
export const getPurchases = async (req, res) => {
    try {        
        if (!checkPermission(req.user.role, "view_purchases")) {
            return res.status(403).json({ message: "Unauthorized access" });
        }

        const purchases = await Purchase.find()
            .select("id total details purchaseDate product")
            .populate("product", "name");

        // Format the date in the response
        const Purchases = purchases.map(purchase => {
            const purchaseObj = purchase.toObject();
            if (purchaseObj.purchaseDate) {
                purchaseObj.purchaseDate = new Date(purchaseObj.purchaseDate).toISOString().split('T')[0];
            }
            return purchaseObj;
        });

        res.status(200).json(Purchases);
    } catch (error) {
        console.error("Error fetching purchases:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// GET: Retrieve a single purchase by ID
export const getPurchaseById = async (req, res) => {
    try {
        if (!checkPermission(req.user.role, "view_purchases_id")) {
            return res.status(403).json({ message: "Unauthorized access" });
        }

        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid purchase ID format" });
        }

        const purchase = await Purchase.findById(id)
            .select("id total details purchaseDate")
            .populate("product", "name price");

        if (!purchase) {
            return res.status(404).json({ message: "Purchase not found" });
        }

        // Format the date in the response
        const formattedPurchase = purchase.toObject();
        if (formattedPurchase.purchaseDate) {
            formattedPurchase.purchaseDate = new Date(formattedPurchase.purchaseDate).toISOString().split('T')[0];
        }

        res.status(200).json(formattedPurchase);
    } catch (error) {
        console.error("Error fetching purchase:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// POST: Create new purchase
export const postPurchase = async (req, res) => {
    try {
        if (!checkPermission(req.user.role, "create_purchases")) {
            return res.status(403).json({ message: "Unauthorized access" });
        }

        const { product, total, details, purchaseDate } = req.body;
        
        // Validate input data
        const validationErrors = validatePurchaseData(req.body);
        if (validationErrors.length > 0) {
            return res.status(400).json({ message: "Validation failed", errors: validationErrors });
        }

        // Check if product exists
        const existingProduct = await Product.findById(product);
        if (!existingProduct) {
            return res.status(404).json({ message: "Product not found" });
        }

        const id = await generatePurchaseId();
        const newPurchase = new Purchase({
            id,
            product,
            purchaseDate: purchaseDate || new Date(),
            total,
            details
        });

        await newPurchase.save();
        
        // Format the date in the response
        const formattedPurchase = newPurchase.toObject();
        if (formattedPurchase.purchaseDate) {
            formattedPurchase.purchaseDate = new Date(formattedPurchase.purchaseDate).toISOString().split('T')[0];
        }
        
        res.status(201).json({ message: "Purchase created successfully", purchase: formattedPurchase });
    } catch (error) {
        console.error("Error creating purchase:", error);
        
        // Handle Mongoose validation errors
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ message: "Validation failed", errors });
        }
        
        res.status(500).json({ message: "Server error" });
    }
};

// PUT: Update an existing purchase
export const updatePurchase = async (req, res) => {
    try {
        if (!checkPermission(req.user.role, "edit_purchases")) {
            return res.status(403).json({ message: "Unauthorized access" });
        }

        const { id } = req.params;
        const { product, purchaseDate, total, details } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid purchase ID format" });
        }

        // Validate input data (with isUpdate flag)
        const validationErrors = validatePurchaseData(req.body, true);
        if (validationErrors.length > 0) {
            return res.status(400).json({ message: "Validation failed", errors: validationErrors });
        }

        let updateFields = {};

        // Check and update product if provided
        if (product) {
            const existingProduct = await Product.findById(product);
            if (!existingProduct) {
                return res.status(404).json({ message: "Product not found" });
            }
            updateFields.product = product;
        }

        // Update other fields if provided
        if (purchaseDate !== undefined) updateFields.purchaseDate = purchaseDate;
        if (total !== undefined) updateFields.total = total;
        if (details !== undefined) updateFields.details = details;
        
        // Check if there are fields to update
        if (Object.keys(updateFields).length === 0) {
            return res.status(400).json({ message: "No valid fields to update" });
        }

        const updatedPurchase = await Purchase.findByIdAndUpdate(id, updateFields, {
            new: true,
            runValidators: true
        })
            .select("id product purchaseDate total details")
            .populate("product", "name");

        if (!updatedPurchase) {
            return res.status(404).json({ message: "Purchase not found" });
        }

        // Format the date in the response
        const formattedPurchase = updatedPurchase.toObject();
        if (formattedPurchase.purchaseDate) {
            formattedPurchase.purchaseDate = new Date(formattedPurchase.purchaseDate).toISOString().split('T')[0];
        }

        res.status(200).json({ message: "Purchase updated successfully", purchase: formattedPurchase });
    } catch (error) {
        console.error("Error updating purchase:", error);
        
        // Handle Mongoose validation errors
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ message: "Validation failed", errors });
        }
        
        res.status(500).json({ message: "Server error" });
    }
};

// DELETE: Remove a purchase by ID
export const deletePurchase = async (req, res) => {
    try {
        if (!checkPermission(req.user.role, "delete_purchases")) {
            return res.status(403).json({ message: "Unauthorized access" });
        }

        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid purchase ID format" });
        }

        const deletedPurchase = await Purchase.findByIdAndDelete(id);

        if (!deletedPurchase) {
            return res.status(404).json({ message: "Purchase not found" });
        }

        res.status(200).json({ message: "Purchase deleted successfully" });
    } catch (error) {
        console.error("Error deleting purchase:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// ===== NUEVAS FUNCIONES DE GENERACIÓN DE INFORMES =====

// GET: Generate a PDF report of purchases
export const generatePdfReport = async (req, res) => {
    try {
        if (!checkPermission(req.user.role, "view_purchases")) {
            return res.status(403).json({ message: "Unauthorized access" });
        }

        // Parse query parameters for filtering
        const { startDate, endDate, productId } = req.query;
        
        // Build query object based on filters
        let query = {};
        
        // Add date range filter
        if (startDate || endDate) {
            query.purchaseDate = {};
            if (startDate) query.purchaseDate.$gte = new Date(startDate);
            if (endDate) query.purchaseDate.$lte = new Date(endDate);
        }
        
        // Add product filter
        if (productId && mongoose.Types.ObjectId.isValid(productId)) {
            query.product = productId;
        }
        
        // Fetch purchases with filters
        const purchases = await Purchase.find(query)
            .sort({ purchaseDate: -1 })
            .populate("product", "name price");
            
        if (purchases.length === 0) {
            return res.status(404).json({ message: "No purchases found for the specified criteria" });
        }
        
        // Create PDF document
        const doc = new PDFDocument({ margin: 50 });
        
        // Set response headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=purchases-report-${Date.now()}.pdf`);
        
        // Pipe the PDF document to the response
        doc.pipe(res);
        
        // Add document title
        doc.fontSize(20).text('Purchases Report', { align: 'center' });
        doc.moveDown();
        
        // Add filters information
        doc.fontSize(12).text('Filters:', { underline: true });
        if (startDate || endDate) {
            let dateText = 'Date range: ';
            if (startDate) dateText += `From ${new Date(startDate).toLocaleDateString()} `;
            if (endDate) dateText += `To ${new Date(endDate).toLocaleDateString()}`;
            doc.text(dateText);
        }
        if (productId) {
            const product = await Product.findById(productId);
            if (product) {
                doc.text(`Product: ${product.name}`);
            }
        }
        doc.moveDown();
        
        // Add summary information
        const totalAmount = purchases.reduce((sum, purchase) => sum + purchase.total, 0);
        doc.fontSize(14).text('Summary', { underline: true });
        doc.fontSize(12).text(`Total Purchases: ${purchases.length}`);
        doc.text(`Total Amount: $${totalAmount.toFixed(2)}`);
        doc.moveDown();
        
        // Add table headers
        doc.fontSize(14).text('Purchase Details', { underline: true });
        doc.moveDown();
        
        // Define table columns
        const tableTop = doc.y;
        const tableColumns = [
            { id: 'id', header: 'ID', width: 60 },
            { id: 'date', header: 'Date', width: 80 },
            { id: 'product', header: 'Product', width: 150 },
            { id: 'details', header: 'Details', width: 150 },
            { id: 'total', header: 'Total', width: 80 }
        ];
        
        // Draw table headers
        let currentX = 50;
        tableColumns.forEach(column => {
            doc.font('Helvetica-Bold').text(column.header, currentX, tableTop, { width: column.width });
            currentX += column.width;
        });
        
        // Draw table content
        doc.font('Helvetica');
        let yPosition = tableTop + 20;
        
        // Add purchase rows
        for (const purchase of purchases) {
            // Check if we need a new page
            if (yPosition > 700) {
                doc.addPage();
                yPosition = 50;
                
                // Redraw headers on new page
                currentX = 50;
                tableColumns.forEach(column => {
                    doc.font('Helvetica-Bold').text(column.header, currentX, yPosition, { width: column.width });
                    currentX += column.width;
                });
                
                doc.font('Helvetica');
                yPosition += 20;
            }
            
            // Draw row
            currentX = 50;
            doc.text(purchase.id, currentX, yPosition, { width: tableColumns[0].width });
            currentX += tableColumns[0].width;
            
            const formattedDate = new Date(purchase.purchaseDate).toLocaleDateString();
            doc.text(formattedDate, currentX, yPosition, { width: tableColumns[1].width });
            currentX += tableColumns[1].width;
            
            const productName = purchase.product ? purchase.product.name : 'Unknown';
            doc.text(productName, currentX, yPosition, { width: tableColumns[2].width });
            currentX += tableColumns[2].width;
            
            // Truncate details if too long
            let details = purchase.details || '';
            if (details.length > 20) {
                details = details.substring(0, 20) + '...';
            }
            doc.text(details, currentX, yPosition, { width: tableColumns[3].width });
            currentX += tableColumns[3].width;
            
            doc.text(`$${purchase.total.toFixed(2)}`, currentX, yPosition, { width: tableColumns[4].width });
            
            yPosition += 20;
        }
        
        // Add footer
        doc.fontSize(10).text(`Report generated on ${new Date().toLocaleString()}`, { align: 'right' });
        
        // Finalize PDF
        doc.end();
        
    } catch (error) {
        console.error("Error generating purchases PDF report:", error);
        res.status(500).json({ message: "Error generating PDF report" });
    }
};

// GET: Generate Excel report of purchases
export const generateExcelReport = async (req, res) => {
    try {
        if (!checkPermission(req.user.role, "view_purchases")) {
            return res.status(403).json({ message: "Unauthorized access" });
        }

        // Parse query parameters for filtering
        const { startDate, endDate, productId } = req.query;
        
        // Build query object based on filters
        let query = {};
        
        // Add date range filter
        if (startDate || endDate) {
            query.purchaseDate = {};
            if (startDate) query.purchaseDate.$gte = new Date(startDate);
            if (endDate) query.purchaseDate.$lte = new Date(endDate);
        }
        
        // Add product filter
        if (productId && mongoose.Types.ObjectId.isValid(productId)) {
            query.product = productId;
        }
        
        // Fetch purchases with filters
        const purchases = await Purchase.find(query)
            .sort({ purchaseDate: -1 })
            .populate("product", "name price");
            
        if (purchases.length === 0) {
            return res.status(404).json({ message: "No purchases found for the specified criteria" });
        }

        // Create a new Excel workbook
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'IceSoft System';
        workbook.created = new Date();
        
        // Add a worksheet
        const worksheet = workbook.addWorksheet('Purchases Report');
        
        // Define columns
        worksheet.columns = [
            { header: 'Purchase ID', key: 'id', width: 15 },
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Product', key: 'product', width: 30 },
            { header: 'Details', key: 'details', width: 40 },
            { header: 'Total', key: 'total', width: 15 }
        ];
        
        // Style header row
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
        
        // Add data rows
        purchases.forEach(purchase => {
            worksheet.addRow({
                id: purchase.id,
                date: new Date(purchase.purchaseDate).toLocaleDateString(),
                product: purchase.product ? purchase.product.name : 'Unknown',
                details: purchase.details || '',
                total: purchase.total
            });
        });
        
        // Format total column as currency
        worksheet.getColumn('total').numFmt = '"$"#,##0.00';
        
        // Add summary section
        worksheet.addRow([]);
        worksheet.addRow(['Summary']);
        worksheet.getCell(`A${worksheet.rowCount}`).font = { bold: true };
        
        worksheet.addRow(['Total Purchases', purchases.length]);
        
        const totalAmount = purchases.reduce((sum, purchase) => sum + purchase.total, 0);
        worksheet.addRow(['Total Amount', totalAmount]);
        worksheet.getCell(`B${worksheet.rowCount}`).numFmt = '"$"#,##0.00';
        
        // Add filter information
        worksheet.addRow([]);
        worksheet.addRow(['Report Filters']);
        worksheet.getCell(`A${worksheet.rowCount}`).font = { bold: true };
        
        if (startDate) {
            worksheet.addRow(['Start Date', new Date(startDate).toLocaleDateString()]);
        }
        if (endDate) {
            worksheet.addRow(['End Date', new Date(endDate).toLocaleDateString()]);
        }
        if (productId) {
            const product = await Product.findById(productId);
            if (product) {
                worksheet.addRow(['Product', product.name]);
            }
        }
        
        // Add generation info
        worksheet.addRow([]);
        worksheet.addRow(['Generated', new Date().toLocaleString()]);
        
        // Set the content type and disposition
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=purchases-report-${Date.now()}.xlsx`);
        
        // Write the workbook to the response
        await workbook.xlsx.write(res);
        res.end();
        
    } catch (error) {
        console.error("Error generating purchases Excel report:", error);
        res.status(500).json({ message: "Error generating Excel report" });
    }
};

// GET: Generate purchase statistics
export const getPurchaseStatistics = async (req, res) => {
    try {
        if (!checkPermission(req.user.role, "view_purchases")) {
            return res.status(403).json({ message: "Unauthorized access" });
        }

        // Parse query parameters for filtering
        const { startDate, endDate, period = 'monthly' } = req.query;
        
        // Build date range filter
        let dateFilter = {};
        if (startDate || endDate) {
            dateFilter = {};
            if (startDate) dateFilter.$gte = new Date(startDate);
            if (endDate) dateFilter.$lte = new Date(endDate);
        } else {
            // Default to last 12 months if no date range specified
            const endDateDefault = new Date();
            const startDateDefault = new Date();
            startDateDefault.setMonth(startDateDefault.getMonth() - 11);
            startDateDefault.setDate(1);
            dateFilter = { $gte: startDateDefault, $lte: endDateDefault };
        }

        // Determine grouping format based on period
        let dateFormat, dateField;
        if (period === 'daily') {
            dateFormat = '%Y-%m-%d';
            dateField = { $dateToString: { format: '%Y-%m-%d', date: '$purchaseDate' } };
        } else if (period === 'weekly') {
            // For weekly, we'll use week number in year
            dateFormat = '%Y-W%V';
            dateField = { 
                $concat: [
                    { $dateToString: { format: '%Y-W', date: '$purchaseDate' } },
                    { $toString: { $week: '$purchaseDate' } }
                ]
            };
        } else if (period === 'yearly') {
            dateFormat = '%Y';
            dateField = { $dateToString: { format: '%Y', date: '$purchaseDate' } };
        } else {
            // Default to monthly
            dateFormat = '%Y-%m';
            dateField = { $dateToString: { format: '%Y-%m', date: '$purchaseDate' } };
        }

        // Run aggregation query
        const statistics = await Purchase.aggregate([
            {
                $match: {
                    purchaseDate: dateFilter
                }
            },
            {
                $group: {
                    _id: dateField,
                    count: { $sum: 1 },
                    totalAmount: { $sum: '$total' },
                    avgAmount: { $avg: '$total' },
                    minAmount: { $min: '$total' },
                    maxAmount: { $max: '$total' }
                }
            },
            {
                $sort: { _id: 1 }
            },
            {
                $project: {
                    _id: 0,
                    period: '$_id',
                    count: 1,
                    totalAmount: { $round: ['$totalAmount', 2] },
                    avgAmount: { $round: ['$avgAmount', 2] },
                    minAmount: { $round: ['$minAmount', 2] },
                    maxAmount: { $round: ['$maxAmount', 2] }
                }
            }
        ]);

        // Calculate overall statistics
        const overall = await Purchase.aggregate([
            {
                $match: {
                    purchaseDate: dateFilter
                }
            },
            {
                $group: {
                    _id: null,
                    totalPurchases: { $sum: 1 },
                    totalAmount: { $sum: '$total' },
                    avgAmount: { $avg: '$total' },
                    minAmount: { $min: '$total' },
                    maxAmount: { $max: '$total' }
                }
            },
            {
                $project: {
                    _id: 0,
                    totalPurchases: 1,
                    totalAmount: { $round: ['$totalAmount', 2] },
                    avgAmount: { $round: ['$avgAmount', 2] },
                    minAmount: { $round: ['$minAmount', 2] },
                    maxAmount: { $round: ['$maxAmount', 2] }
                }
            }
        ]);

        // Get top products by purchase amount
        const topProducts = await Purchase.aggregate([
            {
                $match: {
                    purchaseDate: dateFilter
                }
            },
            {
                $group: {
                    _id: '$product',
                    count: { $sum: 1 },
                    totalAmount: { $sum: '$total' }
                }
            },
            {
                $sort: { totalAmount: -1 }
            },
            {
                $limit: 5
            },
            {
                $lookup: {
                    from: 'products',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'productInfo'
                }
            },
            {
                $unwind: {
                    path: '$productInfo',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    _id: 0,
                    productId: '$_id',
                    productName: { $ifNull: ['$productInfo.name', 'Unknown'] },
                    count: 1,
                    totalAmount: { $round: ['$totalAmount', 2] }
                }
            }
        ]);

        // Return the complete statistics
        res.status(200).json({
            overall: overall.length > 0 ? overall[0] : {
                totalPurchases: 0,
                totalAmount: 0,
                avgAmount: 0,
                minAmount: 0,
                maxAmount: 0
            },
            periodStats: statistics,
            topProducts,
            period,
            dateRange: {
                startDate: dateFilter.$gte ? dateFilter.$gte.toISOString().split('T')[0] : null,
                endDate: dateFilter.$lte ? dateFilter.$lte.toISOString().split('T')[0] : null
            }
        });
        
    } catch (error) {
        console.error("Error generating purchase statistics:", error);
        res.status(500).json({ message: "Error generating statistics", error: error.message });
    }
};