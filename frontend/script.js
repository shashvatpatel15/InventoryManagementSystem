document.addEventListener("DOMContentLoaded", () => {
    // --- Global Variables ---
    const navLinks = document.querySelectorAll(".nav-link");
    const pages = document.querySelectorAll(".dashboard-page");
    const baseUrl = 'http://localhost:3001/api';
    let currentEditState = null; // Holds info if we are editing: { id: 'P101', type: 'products' }

    // --- 1. Page Navigation ---
    function showPage(pageId) {
        resetAllForms(); // Clear any edit state when changing pages
        
        pages.forEach(page => page.classList.remove("active"));
        navLinks.forEach(link => link.classList.remove("active"));
        
        const targetPage = document.getElementById(`${pageId}-page`);
        if (targetPage) targetPage.classList.add("active");
        
        const activeLink = document.querySelector(`a[data-page="${pageId}"]`);
        if (activeLink) activeLink.classList.add("active");

        // Load data for the table on the page we just switched to
        if (!pageId.startsWith('about-us')) {
            loadAllData(pageId);
        }
    }

    navLinks.forEach(link => {
        link.addEventListener("click", (event) => {
            event.preventDefault();
            const pageId = link.getAttribute("data-page");
            showPage(pageId);
        });
    });

    // Show the "Products" page by default
    showPage("products");

    // --- 2. Form Submission (Handles BOTH Create and Update) ---
    async function handleFormSubmit(form, endpoint) {
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        let url = `${baseUrl}/${endpoint}`;
        let method = 'POST';

        // Check if we are in EDIT mode
        if (currentEditState && currentEditState.type === endpoint) {
            url = `${baseUrl}/${endpoint}/${currentEditState.id}`;
            method = 'PUT';
        }

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await response.json();
            
            if (response.ok) {
                alert('Success: ' + result.message);
                resetAllForms(); // Clear the form
                loadAllData(endpoint); // Refresh the table on the right
            } else {
                alert('Error: ' + result.message); // Show error from server (e.g., "ID already exists")
            }
        } catch (err) {
            console.error('Failed to send data:', err);
            alert('Error: Could not connect to the server.');
        }
    }

    // Attach listeners to all forms
    document.getElementById("product-form")?.addEventListener("submit", (e) => { e.preventDefault(); handleFormSubmit(e.target, 'products'); });
    document.getElementById("supplier-form")?.addEventListener("submit", (e) => { e.preventDefault(); handleFormSubmit(e.target, 'suppliers'); });
    document.getElementById("warehouse-form")?.addEventListener("submit", (e) => { e.preventDefault(); handleFormSubmit(e.target, 'warehouses'); });
    document.getElementById("purchase-order-form")?.addEventListener("submit", (e) => { e.preventDefault(); handleFormSubmit(e.target, 'purchase-orders'); });
    document.getElementById("sales-order-form")?.addEventListener("submit", (e) => { e.preventDefault(); handleFormSubmit(e.target, 'sales-orders'); });

    // --- 3. Data Loading (View All & Search) ---

    // Load ALL data (for "View All" / "Refresh")
    async function loadAllData(type) {
        const config = getEndpointConfig(type);
        if (!config) return;
        
        const tableBody = document.querySelector(`#${config.table} tbody`);
        if (!tableBody) return; // Happens on "About Us" page
        
        tableBody.innerHTML = `<tr><td colspan="100%">Loading...</td></tr>`;

        try {
            const response = await fetch(`${baseUrl}/${type}`);
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();
            config.buildFn(data, tableBody); // Build table with all data
        } catch (error) {
            tableBody.innerHTML = `<tr><td colspan="100%">Failed to load data.</td></tr>`;
        }
    }

    // Load ONE item (for "Search")
    async function loadOneData(type) {
        const config = getEndpointConfig(type);
        if (!config) return;

        const id = document.getElementById(config.searchInput).value;
        if (!id) {
            alert('Please enter an ID to search for.');
            return;
        }

        const tableBody = document.querySelector(`#${config.table} tbody`);
        tableBody.innerHTML = `<tr><td colspan="100%">Searching...</td></tr>`;

        try {
            const response = await fetch(`${baseUrl}/${type}/${id}`);
            if (!response.ok) throw new Error('Item not found');
            const item = await response.json();
            
            if (item) {
                config.buildFn([item], tableBody); // Build table with just the one item
            } else {
                tableBody.innerHTML = `<tr><td colspan="100%">No item found with ID: ${id}</td></tr>`;
            }
        } catch (error) {
            tableBody.innerHTML = `<tr><td colspan="100%">Item not found or server error.</td></tr>`;
        }
    }

    // Attach listeners to all "View All" / "Refresh" buttons
    document.querySelectorAll('.refresh-btn').forEach(btn => {
        btn.addEventListener('click', () => loadAllData(btn.getAttribute('data-type')));
    });

    // Attach listeners to all "Search" buttons
    document.querySelectorAll('.btn-search').forEach(btn => {
        btn.addEventListener('click', () => loadOneData(btn.getAttribute('data-type')));
    });

    // --- 4. Global Click Handler (for Edit, Delete, Cancel) ---
    document.addEventListener('click', (event) => {
        const target = event.target;
        if (target.classList.contains('btn-delete')) {
            handleDelete(target);
        }
        if (target.classList.contains('btn-edit')) {
            handleEdit(target);
        }
        if (target.id.endsWith('-form-cancel')) { // Cancel buttons
            resetAllForms();
        }
    });

    // --- 5. Delete Logic ---
    async function handleDelete(button) {
        const id = button.getAttribute('data-id');
        const type = button.getAttribute('data-type');

        if (confirm(`Are you sure you want to delete this item (ID: ${id})?`)) {
            try {
                const response = await fetch(`${baseUrl}/${type}/${id}`, {
                    method: 'DELETE'
                });
                const result = await response.json();
                if (response.ok) {
                    alert('Success: ' + result.message);
                    loadAllData(type); // Refresh the table
                } else {
                    alert(result.message); // Show specific error (e.g., "Cannot delete")
                }
            } catch (err) {
                alert('Error: Could not connect to the server.');
            }
        }
    }

    // --- 6. Edit Logic ---
    async function handleEdit(button) {
        const id = button.getAttribute('data-id');
        const type = button.getAttribute('data-type');
        const config = getEndpointConfig(type);

        // 1. Fetch the latest data for this item
        try {
            const response = await fetch(`${baseUrl}/${type}/${id}`);
            if (!response.ok) throw new Error('Item not found');
            const data = await response.json();
            
            // 2. Set the global edit state
            currentEditState = { id: id, type: type };

            // 3. Pre-fill the correct form
            config.fillFormFn(data);
            
            // 4. Scroll to top to see the form
            window.scrollTo(0, 0);

        } catch (err) {
            alert('Error: Could not load item data to edit.');
        }
    }

    // --- 7. Utility Functions ---

    // Resets all forms to their "Add" state
    function resetAllForms() {
        document.querySelectorAll('form').forEach(form => form.reset());
        
        document.querySelectorAll('.widget-title[id$="-form-title"]').forEach(h2 => h2.textContent = h2.textContent.replace('Edit', 'Add').replace('Save', 'Create'));
        document.querySelectorAll('.btn-primary[id$="-form-submit"]').forEach(btn => btn.textContent = btn.textContent.replace('Save Changes', 'Add'));
        document.querySelectorAll('input[id$="_id"]').forEach(input => input.disabled = false); // Re-enable ID fields
        document.querySelectorAll('.btn-secondary[id$="-form-cancel"]').forEach(btn => btn.style.display = 'none');

        currentEditState = null;
    }

    // Helper to get all config in one place
    function getEndpointConfig(type) {
        const map = {
            'products': { 
                table: 'products-table', buildFn: buildProductsTable, searchInput: 'search-product-id',
                fillFormFn: fillProductForm
            },
            'suppliers': { 
                table: 'suppliers-table', buildFn: buildSuppliersTable, searchInput: 'search-supplier-id',
                fillFormFn: fillSupplierForm
            },
            'warehouses': { 
                table: 'warehouses-table', buildFn: buildWarehousesTable, searchInput: 'search-warehouse-id',
                fillFormFn: fillWarehouseForm
            },
            'purchase-orders': { 
                table: 'pos-table', buildFn: buildPOsTable, searchInput: 'search-po-id',
                fillFormFn: fillPOForm
            },
            'sales-orders': { 
                table: 'sos-table', buildFn: buildSOSTable, searchInput: 'search-so-id',
                fillFormFn: fillSOForm
            }
        };
        return map[type];
    }
    
    // --- 8. Table Builder Functions (Create HTML for rows) ---
    function buildProductsTable(data, tableBody) {
        tableBody.innerHTML = '';
        if (data.length === 0) tableBody.innerHTML = `<tr><td colspan="6">No products found.</td></tr>`;
        data.forEach(item => {
            tableBody.innerHTML += `
                <tr>
                    <td>${item.product_id}</td><td>${item.name}</td><td>${item.qty}</td><td>$${item.price}</td><td>${item.warehouse_id}</td>
                    <td>
                        <button class="btn-edit" data-id="${item.product_id}" data-type="products">Edit</button>
                        <button class="btn-delete" data-id="${item.product_id}" data-type="products">Delete</button>
                    </td>
                </tr>`;
        });
    }
    function buildSuppliersTable(data, tableBody) {
        tableBody.innerHTML = '';
        if (data.length === 0) tableBody.innerHTML = `<tr><td colspan="4">No suppliers found.</td></tr>`;
        data.forEach(item => {
            tableBody.innerHTML += `
                <tr>
                    <td>${item.supplier_id}</td><td>${item.name}</td><td>${item.phone_no}</td>
                    <td>
                        <button class="btn-edit" data-id="${item.supplier_id}" data-type="suppliers">Edit</button>
                        <button class="btn-delete" data-id="${item.supplier_id}" data-type="suppliers">Delete</button>
                    </td>
                </tr>`;
        });
    }
    function buildWarehousesTable(data, tableBody) {
        tableBody.innerHTML = '';
        if (data.length === 0) tableBody.innerHTML = `<tr><td colspan="4">No warehouses found.</td></tr>`;
        data.forEach(item => {
            tableBody.innerHTML += `
                <tr>
                    <td>${item.warehouse_id}</td><td>${item.name}</td><td>${item.location}</td>
                    <td>
                        <button class="btn-edit" data-id="${item.warehouse_id}" data-type="warehouses">Edit</button>
                        <button class="btn-delete" data-id="${item.warehouse_id}" data-type="warehouses">Delete</button>
                    </td>
                </tr>`;
        });
    }
    function buildPOsTable(data, tableBody) {
        tableBody.innerHTML = '';
        if (data.length === 0) tableBody.innerHTML = `<tr><td colspan="7">No purchase orders found.</td></tr>`;
        data.forEach(item => {
            tableBody.innerHTML += `
                <tr>
                    <td>${item.po_id}</td><td>${item.product_id}</td><td>${item.supplier_id}</td><td>${item.qty_req}</td><td>$${item.price}</td>
                    <td>${new Date(item.order_date).toLocaleDateString()}</td>
                    <td>
                        <button class="btn-edit" data-id="${item.po_id}" data-type="purchase-orders">Edit</button>
                        <button class="btn-delete" data-id="${item.po_id}" data-type="purchase-orders">Delete</button>
                    </td>
                </tr>`;
        });
    }
    function buildSOSTable(data, tableBody) {
        tableBody.innerHTML = '';
        if (data.length === 0) tableBody.innerHTML = `<tr><td colspan="7">No sales orders found.</td></tr>`;
        data.forEach(item => {
            tableBody.innerHTML += `
                <tr>
                    <td>${item.so_id}</td><td>${item.product_id}</td><td>${item.supplier_id}</td><td>${item.qty}</td><td>$${item.price}</td>
                    <td>${new Date(item.sale_date).toLocaleDateString()}</td>
                    <td>
                        <button class="btn-edit" data-id="${item.so_id}" data-type="sales-orders">Edit</button>
                        <button class="btn-delete" data-id="${item.so_id}" data-type="sales-orders">Delete</button>
                    </td>
                </tr>`;
        });
    }

    // --- 9. Form Filler Functions (for Edit) ---
    function prepareEditForm(titleEl, submitEl, cancelEl, idEl) {
        titleEl.textContent = titleEl.textContent.replace('Add', 'Edit').replace('Create', 'Save');
        submitEl.textContent = submitEl.textContent.replace('Add', 'Save Changes').replace('Create', 'Save');
        cancelEl.style.display = 'inline-block';
        if (idEl) idEl.disabled = true; // Don't allow editing the Primary Key
    }

    function fillProductForm(data) {
        prepareEditForm(
            document.getElementById('product-form-title'),
            document.getElementById('product-form-submit'),
            document.getElementById('product-form-cancel'),
            document.getElementById('product_id')
        );
        document.getElementById('product_id').value = data.product_id;
        document.getElementById('product_name').value = data.name;
        document.getElementById('product_qty').value = data.qty;
        document.getElementById('product_price').value = data.price;
        document.getElementById('product_warehouse_id').value = data.warehouse_id;
    }
    function fillSupplierForm(data) {
        prepareEditForm(
            document.getElementById('supplier-form-title'),
            document.getElementById('supplier-form-submit'),
            document.getElementById('supplier-form-cancel'),
            document.getElementById('supplier_id')
        );
        document.getElementById('supplier_id').value = data.supplier_id;
        document.getElementById('supplier_name').value = data.name;
        document.getElementById('supplier_phone').value = data.phone_no;
    }
    function fillWarehouseForm(data) {
        prepareEditForm(
            document.getElementById('warehouse-form-title'),
            document.getElementById('warehouse-form-submit'),
            document.getElementById('warehouse-form-cancel'),
            document.getElementById('warehouse_id')
        );
        document.getElementById('warehouse_id').value = data.warehouse_id;
        document.getElementById('warehouse_name').value = data.name;
        document.getElementById('warehouse_location').value = data.location;
    }
    function fillPOForm(data) {
        prepareEditForm(
            document.getElementById('po-form-title'),
            document.getElementById('po-form-submit'),
            document.getElementById('po-form-cancel'),
            null // No ID field to disable
        );
        document.getElementById('po_product_id').value = data.product_id;
        document.getElementById('po_supplier_id').value = data.supplier_id;
        document.getElementById('po_qty_req').value = data.qty_req;
        document.getElementById('po_price').value = data.price;
    }
    function fillSOForm(data) {
        prepareEditForm(
            document.getElementById('so-form-title'),
            document.getElementById('so-form-submit'),
            document.getElementById('so-form-cancel'),
            null // No ID field to disable
        );
        document.getElementById('so_product_id').value = data.product_id;
        document.getElementById('so_supplier_id').value = data.supplier_id;
        document.getElementById('so_qty').value = data.qty;
        document.getElementById('so_price').value = data.price;
    }
});