export const checkPermission = (role, action) => {
    const permissions = {
        admin: ["view_roles", "create_roles", "create_users", "view_users", "view_users_id", "update_users", "delete_users",
                "view_categories", "view_categories_id", "create_categories", "update_categories", "delete_categories",
                "view_products", "view_products_id", "create_products", "edit_products", "delete_products",
                "view_providers", "view_providers_id", "create_providers", "update_providers", "delete_providers",
                "view_purchases", "view_purchases_id", "create_purchases", "update_purchases", "delete_purchases",
                "view_branches","view_branches","create_branches","update_branches","delete_branches", "view_customers",
                "view_customers", "view_customers_id", "create_customers","update_customers","delete_customers",
                "view_sales","view_sales_id", "create_sales","update_sales", "delete_sales"],
        assistant: ["view_roles", "create_users", "view_users", "view_users_id", "update_users",
                "view_categories", "create_categories", "update_categories","view_customers",
                "view_products", "create_products", "update_products", "delete_products",
                "view_providers", "view_providers_id", "create_providers", "update_providers",
                "view_purchases", "view_purchases_id", "create_purchases", "update_purchases",
                "view_customers", "view_customers_id", "create_customers","update_customers",
                "view_sales","view_sales_id", "create_sales","update_sales"],
        employee: ["view_categories", "view_products", "view_customers","view_sales", "view_customers_id","create_sales", "update_sales"]

    };

    return permissions[role]?.includes(action);
};