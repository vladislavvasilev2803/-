let token = localStorage.getItem("employee_token");
let currentUser = null;
let employees = [];
let departments = [];

const statuses = {
    "На работе": "work",
    "В отпуске": "vacation",
    "На больничном": "sick",
    "Уволен": "fired",
    "Командировка/удалённая работа": "remote",
    "Удалённая работа": "remote"
};


// =====================================================
// API
// =====================================================

async function api(url, options = {}) {

    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {})
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url, {
        ...options,
        headers
    });

    let data;

    try {
        data = await response.json();
    } catch {
        data = {};
    }

    if (!response.ok) {
        throw new Error(
            data.error || `Ошибка сервера: ${response.status}`
        );
    }

    return data;
}


// =====================================================
// LOGIN
// =====================================================

document
    .getElementById("loginForm")
    .addEventListener("submit", async event => {

        event.preventDefault();

        const login =
            document
                .getElementById("login")
                .value
                .trim();

        const password =
            document
                .getElementById("password")
                .value;

        const error =
            document.getElementById("loginError");

        error.textContent = "";

        if (!login || !password) {
            error.textContent =
                "Введите логин и пароль";
            return;
        }

        try {

            const data = await api(
                "/api/login",
                {
                    method: "POST",

                    body: JSON.stringify({
                        login,
                        password
                    })
                }
            );

            console.log(
                "Ответ авторизации:",
                data
            );

            token = data.token;

            localStorage.setItem(
                "employee_token",
                token
            );

            await startApp();

        } catch (e) {

            console.error(
                "Ошибка авторизации:",
                e
            );

            error.textContent =
                e.message || "Ошибка авторизации";
        }
    });


// =====================================================
// START APP
// =====================================================

async function startApp() {

    if (!token) {
        showLogin();
        return;
    }

    try {

        const data =
            await api("/api/me");

        console.log(
            "Данные пользователя:",
            data
        );

        // Сервер возвращает { user: {...} }
        currentUser = data.user;

        if (!currentUser) {
            throw new Error(
                "Не удалось получить данные пользователя"
            );
        }


        // Скрываем страницу авторизации

        document
            .getElementById("loginPage")
            .classList.add("hidden");


        // Показываем приложение

        document
            .getElementById("app")
            .classList.remove("hidden");


        // Имя пользователя

        document
            .getElementById("userName")
            .textContent =
            currentUser.full_name ||
            currentUser.username;


        // Роль

        document
            .getElementById("userRole")
            .textContent =
            currentUser.role === "admin"
                ? "Администратор"
                : "Руководитель";


        // Загружаем основные данные

        await loadData();


        // Настройки для менеджера

        if (currentUser.role === "manager") {

            document
                .getElementById("pageTitle")
                .textContent =
                currentUser.department_name ||
                "Мой отдел";

            document
                .getElementById("pageSubtitle")
                .textContent =
                "Сотрудники вашего отдела";


            const addButton =
                document.getElementById(
                    "addEmployeeButton"
                );

            if (addButton) {
                addButton.classList.add("hidden");
            }


            const adminSection =
                document.getElementById(
                    "adminSection"
                );

            if (adminSection) {
                adminSection.classList.add("hidden");
            }

        } else {

            // Настройки администратора

            document
                .getElementById("pageTitle")
                .textContent =
                "Все сотрудники";

            document
                .getElementById("pageSubtitle")
                .textContent =
                "Управление сотрудниками компании";


            const adminSection =
                document.getElementById(
                    "adminSection"
                );

            if (adminSection) {
                adminSection.classList.remove("hidden");
            }


            const addButton =
                document.getElementById(
                    "addEmployeeButton"
                );

            if (addButton) {
                addButton.classList.remove("hidden");
            }


            await loadAdminData();
        }


    } catch (e) {

        console.error(
            "Ошибка запуска приложения:",
            e
        );

        logout();
    }
}


// =====================================================
// SHOW LOGIN
// =====================================================

function showLogin() {

    document
        .getElementById("loginPage")
        .classList.remove("hidden");

    document
        .getElementById("app")
        .classList.add("hidden");
}


// =====================================================
// LOAD DATA
// =====================================================

async function loadData() {

    const employeeData =
        await api("/api/employees");

    const departmentData =
        await api("/api/departments");


    // Сервер возвращает:
    // { employees: [...] }

    employees =
        Array.isArray(employeeData.employees)
            ? employeeData.employees
            : [];


    // Сервер возвращает:
    // { departments: [...] }

    departments =
        Array.isArray(departmentData.departments)
            ? departmentData.departments
            : [];


    renderDepartmentsFilter();

    renderStats();

    renderEmployees();
}


// =====================================================
// STATISTICS
// =====================================================

function renderStats() {

    const counts = {

        "На работе": 0,
        "В отпуске": 0,
        "На больничном": 0,
        "Уволен": 0,
        "Командировка/удалённая работа": 0

    };


    employees.forEach(employee => {

        if (
            counts[employee.status] !== undefined
        ) {

            counts[employee.status]++;
        }

    });


    const stats =
        document.getElementById("stats");


    if (!stats) {
        return;
    }


    stats.innerHTML = `

        ${stat(
            "На работе",
            counts["На работе"]
        )}

        ${stat(
            "В отпуске",
            counts["В отпуске"]
        )}

        ${stat(
            "На больничном",
            counts["На больничном"]
        )}

        ${stat(
            "Удалённо / командировка",
            counts["Командировка/удалённая работа"]
        )}

        ${stat(
            "Уволены",
            counts["Уволен"]
        )}

    `;
}


function stat(label, value) {

    return `

        <div class="stat">

            <div class="stat-label">
                ${label}
            </div>

            <div class="stat-value">
                ${value}
            </div>

        </div>

    `;
}


// =====================================================
// FILTER
// =====================================================

function renderDepartmentsFilter() {

    const select =
        document.getElementById(
            "departmentFilter"
        );

    if (!select) {
        return;
    }


    select.innerHTML = `

        <option value="all">
            Все отделы
        </option>

    `;


    departments.forEach(department => {

        const option =
            document.createElement("option");

        option.value =
            department.id;

        option.textContent =
            department.name;

        select.appendChild(option);

    });
}


// SEARCH

const searchElement =
    document.getElementById("search");

if (searchElement) {

    searchElement.addEventListener(
        "input",
        renderEmployees
    );
}


// DEPARTMENT FILTER

const departmentFilter =
    document.getElementById(
        "departmentFilter"
    );

if (departmentFilter) {

    departmentFilter.addEventListener(
        "change",
        renderEmployees
    );
}


// STATUS FILTER

const statusFilter =
    document.getElementById(
        "statusFilter"
    );

if (statusFilter) {

    statusFilter.addEventListener(
        "change",
        renderEmployees
    );
}


// =====================================================
// EMPLOYEE TABLE
// =====================================================

function renderEmployees() {

    const searchElement =
        document.getElementById("search");

    const departmentElement =
        document.getElementById(
            "departmentFilter"
        );

    const statusElement =
        document.getElementById(
            "statusFilter"
        );


    const search =
        searchElement
            ? searchElement.value.toLowerCase()
            : "";


    const department =
        departmentElement
            ? departmentElement.value
            : "all";


    const status =
        statusElement
            ? statusElement.value
            : "all";


    const filtered =
        employees.filter(employee => {

            const fullName =
                employee.full_name || "";

            const position =
                employee.position || "";

            const email =
                employee.email || "";


            const matchesSearch =

                fullName
                    .toLowerCase()
                    .includes(search)

                ||

                position
                    .toLowerCase()
                    .includes(search)

                ||

                email
                    .toLowerCase()
                    .includes(search);


            const matchesDepartment =
                department === "all" ||
                String(employee.department_id) ===
                String(department);


            const matchesStatus =
                status === "all" ||
                employee.status === status;


            return (
                matchesSearch &&
                matchesDepartment &&
                matchesStatus
            );

        });


    const countElement =
        document.getElementById(
            "employeeCount"
        );


    if (countElement) {

        countElement.textContent =
            `${filtered.length} сотрудников`;
    }


    const tbody =
        document.getElementById(
            "employeeTable"
        );


    if (!tbody) {
        return;
    }


    tbody.innerHTML = "";


    filtered.forEach(employee => {

        const tr =
            document.createElement("tr");


        const initials =
            (employee.full_name || "С")
                .split(" ")
                .map(x => x[0] || "")
                .join("")
                .substring(0, 2)
                .toUpperCase();


        const statusClass =
            statuses[employee.status] || "";


        let actions = "";


        if (
            currentUser &&
            currentUser.role === "admin"
        ) {

            actions = `

                <div class="actions">

                    <button
                        class="small-button"
                        onclick="editEmployee(${employee.id})"
                    >
                        Изменить
                    </button>

                    <button
                        class="small-button"
                        onclick="deleteEmployee(${employee.id})"
                    >
                        Удалить
                    </button>

                </div>

            `;
        }


        tr.innerHTML = `

            <td>

                <div class="employee">

                    <div class="employee-avatar">
                        ${initials}
                    </div>

                    <div>

                        <div class="employee-name">
                            ${employee.full_name || "—"}
                        </div>

                        <div class="employee-email">
                            ${employee.email || ""}
                        </div>

                    </div>

                </div>

            </td>


            <td>
                ${employee.position || "—"}
            </td>


            <td>
                ${employee.department_name || "—"}
            </td>


            <td>

                <span
                    class="status ${statusClass}"
                >

                    <span class="status-dot"></span>

                    ${employee.status || "—"}

                </span>

            </td>


            <td>
                ${employee.status_date || "—"}
            </td>


            <td>
                ${actions}
            </td>

        `;


        tbody.appendChild(tr);

    });
}


// =====================================================
// EMPLOYEE MODAL
// =====================================================

function openEmployeeModal(id = null) {

    const form =
        document.getElementById(
            "employeeForm"
        );

    if (form) {
        form.reset();
    }


    document
        .getElementById("employeeId")
        .value = id || "";


    const select =
        document.getElementById(
            "employeeDepartment"
        );


    select.innerHTML = "";


    departments.forEach(department => {

        select.innerHTML += `

            <option value="${department.id}">
                ${department.name}
            </option>

        `;

    });


    if (id) {

        const employee =
            employees.find(
                employee =>
                    employee.id === id
            );


        if (!employee) {
            return;
        }


        document
            .getElementById("employeeName")
            .value =
            employee.full_name || "";


        document
            .getElementById("employeeEmail")
            .value =
            employee.email || "";


        document
            .getElementById("employeePosition")
            .value =
            employee.position || "";


        document
            .getElementById("employeeDepartment")
            .value =
            employee.department_id;


        document
            .getElementById("employeeStatus")
            .value =
            employee.status || "";

    }


    document
        .getElementById("employeeModal")
        .classList.remove("hidden");
}


function editEmployee(id) {

    openEmployeeModal(id);
}


// =====================================================
// SAVE EMPLOYEE
// =====================================================

const employeeForm =
    document.getElementById(
        "employeeForm"
    );


if (employeeForm) {

    employeeForm.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            const id =
                document.getElementById(
                    "employeeId"
                ).value;


            const data = {

                full_name:
                    document.getElementById(
                        "employeeName"
                    ).value,

                email:
                    document.getElementById(
                        "employeeEmail"
                    ).value,

                position:
                    document.getElementById(
                        "employeePosition"
                    ).value,

                department_id:
                    Number(
                        document.getElementById(
                            "employeeDepartment"
                        ).value
                    ),

                status:
                    document.getElementById(
                        "employeeStatus"
                    ).value

            };


            try {

                await api(
                    id
                        ? `/api/employees/${id}`
                        : "/api/employees",

                    {
                        method:
                            id
                                ? "PUT"
                                : "POST",

                        body:
                            JSON.stringify(data)
                    }
                );


                closeModal(
                    "employeeModal"
                );


                await loadData();


            } catch (e) {

                alert(e.message);

            }

        }
    );
}


// =====================================================
// DELETE EMPLOYEE
// =====================================================

async function deleteEmployee(id) {

    if (
        !confirm(
            "Удалить этого сотрудника?"
        )
    ) {

        return;
    }


    try {

        await api(
            `/api/employees/${id}`,
            {
                method: "DELETE"
            }
        );


        await loadData();


    } catch (e) {

        alert(e.message);

    }
}


// =====================================================
// ADMIN
// =====================================================

async function loadAdminData() {

    renderDepartmentsAdmin();


    const data =
        await api("/api/users");


    // Сервер возвращает { users: [...] }

    const users =
        Array.isArray(data.users)
            ? data.users
            : [];


    const container =
        document.getElementById(
            "usersList"
        );


    if (!container) {
        return;
    }


    container.innerHTML = "";


    users.forEach(user => {

        container.innerHTML += `

            <div class="admin-item">

                <div>

                    <strong>
                        ${user.full_name || "—"}
                    </strong>

                    <small>

                        ${user.username || ""}

                        ·

                        ${
                            user.role === "admin"
                                ? "Администратор"
                                : "Руководитель"
                        }

                        ${
                            user.department_name
                                ? " · " +
                                  user.department_name
                                : ""
                        }

                    </small>

                </div>

            </div>

        `;

    });
}


// =====================================================
// ADMIN DEPARTMENTS
// =====================================================

function renderDepartmentsAdmin() {

    const container =
        document.getElementById(
            "departmentsList"
        );


    if (!container) {
        return;
    }


    container.innerHTML = "";


    departments.forEach(department => {

        container.innerHTML += `

            <div class="admin-item">

                <div>

                    <strong>
                        ${department.name}
                    </strong>

                    <small>
                        Отдел
                    </small>

                </div>

            </div>

        `;

    });
}


// =====================================================
// ADD DEPARTMENT
// =====================================================

async function addDepartment() {

    const name =
        prompt("Название отдела:");


    if (!name) {
        return;
    }


    try {

        await api(
            "/api/departments",
            {
                method: "POST",

                body:
                    JSON.stringify({
                        name
                    })
            }
        );


        await loadData();

        renderDepartmentsAdmin();


    } catch (e) {

        alert(e.message);

    }
}


// =====================================================
// USER MODAL
// =====================================================

function openUserModal() {

    const select =
        document.getElementById(
            "userDepartment"
        );


    if (!select) {
        return;
    }


    select.innerHTML = "";


    departments.forEach(department => {

        select.innerHTML += `

            <option value="${department.id}">
                ${department.name}
            </option>

        `;

    });


    document
        .getElementById("userModal")
        .classList.remove("hidden");
}


// =====================================================
// CREATE USER
// =====================================================

const userForm =
    document.getElementById(
        "userForm"
    );


if (userForm) {

    userForm.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            const role =
                document
                    .getElementById(
                        "userRole"
                    )
                    .value;


            const data = {

                full_name:
                    document
                        .getElementById(
                            "userFullName"
                        )
                        .value,

                username:
                    document
                        .getElementById(
                            "userLogin"
                        )
                        .value,

                password:
                    document
                        .getElementById(
                            "userPassword"
                        )
                        .value,

                role,

                department_id:
                    role === "manager"
                        ? Number(
                            document
                                .getElementById(
                                    "userDepartment"
                                )
                                .value
                        )
                        : null

            };


            try {

                await api(
                    "/api/users",
                    {
                        method: "POST",

                        body:
                            JSON.stringify(data)
                    }
                );


                closeModal(
                    "userModal"
                );


                await loadAdminData();


            } catch (e) {

                alert(e.message);

            }

        }
    );
}


// =====================================================
// MODAL
// =====================================================

function closeModal(id) {

    const modal =
        document.getElementById(id);


    if (modal) {

        modal.classList.add(
            "hidden"
        );
    }
}


// =====================================================
// LOGOUT
// =====================================================

function logout() {

    localStorage.removeItem(
        "employee_token"
    );


    token = null;

    currentUser = null;

    employees = [];

    departments = [];


    showLogin();
}


// =====================================================
// INIT
// =====================================================

startApp();