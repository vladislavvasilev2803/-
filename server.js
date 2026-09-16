const express = require("express");
const path = require("path");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const {
    initDatabase,
    getOne,
    getAll,
    run
} = require("./database");

const app = express();
const PORT = 3000;

const JWT_SECRET =
    process.env.JWT_SECRET ||
    "employee-status-dev-secret-change-me";

// =====================================================
// EXPRESS
// =====================================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
    express.static(path.join(__dirname, "public"))
);

// =====================================================
// JWT
// =====================================================

function authenticateToken(req, res, next) {

    const authHeader = req.headers.authorization;

    const token =
        authHeader && authHeader.startsWith("Bearer ")
            ? authHeader.split(" ")[1]
            : null;

    if (!token) {
        return res.status(401).json({
            error: "Требуется авторизация"
        });
    }

    try {

        req.user = jwt.verify(
            token,
            JWT_SECRET
        );

        next();

    } catch (error) {

        console.error(
            "Ошибка проверки токена:",
            error.message
        );

        return res.status(403).json({
            error: "Недействительный или просроченный токен"
        });
    }
}

// =====================================================
// ADMIN
// =====================================================

function adminOnly(req, res, next) {

    if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({
            error: "Доступ только для администратора"
        });
    }

    next();
}

// =====================================================
// LOGIN
// =====================================================

app.post("/api/login", async (req, res) => {

    try {

        console.log("");
        console.log("=================================");
        console.log("ПОПЫТКА АВТОРИЗАЦИИ");
        console.log("=================================");

        console.log("Полученные данные:", req.body);

        const login =
            typeof req.body?.login === "string"
                ? req.body.login.trim()
                : "";

        const password =
            typeof req.body?.password === "string"
                ? req.body.password
                : "";

        console.log("Логин:", login);
        console.log(
            "Пароль получен:",
            password ? "ДА" : "НЕТ"
        );

        if (!login || !password) {

            console.log(
                "ОШИБКА: логин или пароль не заполнен"
            );

            return res.status(400).json({
                error: "Введите логин и пароль"
            });
        }

        const user = getOne(
            `
            SELECT
                id,
                username,
                password,
                role,
                department_id,
                full_name
            FROM users
            WHERE username = ?
            `,
            [login]
        );

        console.log(
            "Пользователь:",
            user ? user.username : "НЕ НАЙДЕН"
        );

        if (!user) {

            return res.status(401).json({
                error: "Неверный логин или пароль"
            });
        }

        const passwordCorrect =
            await bcrypt.compare(
                password,
                user.password
            );

        console.log(
            "Пароль:",
            passwordCorrect
                ? "ВЕРНЫЙ"
                : "НЕВЕРНЫЙ"
        );

        if (!passwordCorrect) {

            return res.status(401).json({
                error: "Неверный логин или пароль"
            });
        }

        const token = jwt.sign(
            {
                id: user.id,
                username: user.username,
                role: user.role,
                department_id: user.department_id,
                full_name: user.full_name
            },
            JWT_SECRET,
            {
                expiresIn: "8h"
            }
        );

        console.log(
            "Авторизация успешна:",
            user.username
        );

        console.log("=================================");
        console.log("");

        return res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                department_id: user.department_id,
                full_name: user.full_name
            }
        });

    } catch (error) {

        console.error("");
        console.error("ОШИБКА /api/login:");
        console.error(error);
        console.error("");

        return res.status(500).json({
            error: "Внутренняя ошибка сервера"
        });
    }
});

// =====================================================
// CURRENT USER
// =====================================================

app.get(
    "/api/me",
    authenticateToken,
    (req, res) => {

        try {

            const user = getOne(
                `
                SELECT
                    id,
                    username,
                    role,
                    department_id,
                    full_name
                FROM users
                WHERE id = ?
                `,
                [req.user.id]
            );

            if (!user) {

                return res.status(404).json({
                    error: "Пользователь не найден"
                });
            }

            return res.json({
                user
            });

        } catch (error) {

            console.error(
                "Ошибка /api/me:",
                error
            );

            return res.status(500).json({
                error: "Ошибка сервера"
            });
        }
    }
);

// =====================================================
// EMPLOYEES
// =====================================================

app.get(
    "/api/employees",
    authenticateToken,
    (req, res) => {

        try {

            let employees;

            if (req.user.role === "admin") {

                employees = getAll(
                    `
                    SELECT
                        employees.*,
                        departments.name AS department_name
                    FROM employees
                    LEFT JOIN departments
                        ON employees.department_id = departments.id
                    ORDER BY employees.full_name
                    `
                );

            } else {

                employees = getAll(
                    `
                    SELECT
                        employees.*,
                        departments.name AS department_name
                    FROM employees
                    LEFT JOIN departments
                        ON employees.department_id = departments.id
                    WHERE employees.department_id = ?
                    ORDER BY employees.full_name
                    `,
                    [req.user.department_id]
                );
            }

            return res.json({
                employees
            });

        } catch (error) {

            console.error(
                "Ошибка получения сотрудников:",
                error
            );

            return res.status(500).json({
                error: "Ошибка сервера"
            });
        }
    }
);

// =====================================================
// DEPARTMENTS
// =====================================================

app.get(
    "/api/departments",
    authenticateToken,
    (req, res) => {

        try {

            let departments;

            if (req.user.role === "admin") {

                departments = getAll(
                    `
                    SELECT *
                    FROM departments
                    ORDER BY name
                    `
                );

            } else {

                departments = getAll(
                    `
                    SELECT *
                    FROM departments
                    WHERE id = ?
                    `,
                    [req.user.department_id]
                );
            }

            return res.json({
                departments
            });

        } catch (error) {

            console.error(
                "Ошибка получения отделов:",
                error
            );

            return res.status(500).json({
                error: "Ошибка сервера"
            });
        }
    }
);

// =====================================================
// ADD EMPLOYEE
// =====================================================

app.post(
    "/api/employees",
    authenticateToken,
    adminOnly,
    (req, res) => {

        try {

            const {
                full_name,
                position,
                department_id,
                status,
                email,
                phone,
                comment
            } = req.body;

            if (
                !full_name ||
                !position ||
                !department_id ||
                !status
            ) {

                return res.status(400).json({
                    error: "Заполните обязательные поля"
                });
            }

            run(
                `
                INSERT INTO employees
                (
                    full_name,
                    position,
                    department_id,
                    status,
                    email,
                    phone,
                    comment
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
                `,
                [
                    full_name,
                    position,
                    department_id,
                    status,
                    email || "",
                    phone || "",
                    comment || ""
                ]
            );

            return res.status(201).json({
                message: "Сотрудник добавлен"
            });

        } catch (error) {

            console.error(
                "Ошибка добавления сотрудника:",
                error
            );

            return res.status(500).json({
                error: "Ошибка сервера"
            });
        }
    }
);

// =====================================================
// UPDATE EMPLOYEE
// =====================================================

app.put(
    "/api/employees/:id",
    authenticateToken,
    adminOnly,
    (req, res) => {

        try {

            const employeeId =
                Number(req.params.id);

            const {
                full_name,
                position,
                department_id,
                status,
                email,
                phone,
                comment
            } = req.body;

            if (
                !employeeId ||
                !full_name ||
                !position ||
                !department_id ||
                !status
            ) {

                return res.status(400).json({
                    error: "Некорректные данные"
                });
            }

            run(
                `
                UPDATE employees
                SET
                    full_name = ?,
                    position = ?,
                    department_id = ?,
                    status = ?,
                    email = ?,
                    phone = ?,
                    comment = ?
                WHERE id = ?
                `,
                [
                    full_name,
                    position,
                    department_id,
                    status,
                    email || "",
                    phone || "",
                    comment || "",
                    employeeId
                ]
            );

            return res.json({
                message: "Сотрудник обновлён"
            });

        } catch (error) {

            console.error(
                "Ошибка изменения сотрудника:",
                error
            );

            return res.status(500).json({
                error: "Ошибка сервера"
            });
        }
    }
);

// =====================================================
// DELETE EMPLOYEE
// =====================================================

app.delete(
    "/api/employees/:id",
    authenticateToken,
    adminOnly,
    (req, res) => {

        try {

            const employeeId =
                Number(req.params.id);

            if (!employeeId) {

                return res.status(400).json({
                    error: "Некорректный ID сотрудника"
                });
            }

            run(
                `
                DELETE FROM employees
                WHERE id = ?
                `,
                [employeeId]
            );

            return res.json({
                message: "Сотрудник удалён"
            });

        } catch (error) {

            console.error(
                "Ошибка удаления сотрудника:",
                error
            );

            return res.status(500).json({
                error: "Ошибка сервера"
            });
        }
    }
);

// =====================================================
// ADD DEPARTMENT
// =====================================================

app.post(
    "/api/departments",
    authenticateToken,
    adminOnly,
    (req, res) => {

        try {

            const name =
                typeof req.body?.name === "string"
                    ? req.body.name.trim()
                    : "";

            if (!name) {

                return res.status(400).json({
                    error: "Введите название отдела"
                });
            }

            run(
                `
                INSERT INTO departments (name)
                VALUES (?)
                `,
                [name]
            );

            return res.status(201).json({
                message: "Отдел добавлен"
            });

        } catch (error) {

            console.error(
                "Ошибка добавления отдела:",
                error
            );

            return res.status(500).json({
                error: "Ошибка сервера"
            });
        }
    }
);

// =====================================================
// DELETE DEPARTMENT
// =====================================================

app.delete(
    "/api/departments/:id",
    authenticateToken,
    adminOnly,
    (req, res) => {

        try {

            const departmentId =
                Number(req.params.id);

            const employees = getOne(
                `
                SELECT COUNT(*) AS count
                FROM employees
                WHERE department_id = ?
                `,
                [departmentId]
            );

            if (
                employees &&
                employees.count > 0
            ) {

                return res.status(400).json({
                    error:
                        "Нельзя удалить отдел, в котором есть сотрудники"
                });
            }

            run(
                `
                DELETE FROM departments
                WHERE id = ?
                `,
                [departmentId]
            );

            return res.json({
                message: "Отдел удалён"
            });

        } catch (error) {

            console.error(
                "Ошибка удаления отдела:",
                error
            );

            return res.status(500).json({
                error: "Ошибка сервера"
            });
        }
    }
);

// =====================================================
// USERS
// =====================================================

app.get(
    "/api/users",
    authenticateToken,
    adminOnly,
    (req, res) => {

        try {

            const users = getAll(
                `
                SELECT
                    users.id,
                    users.username,
                    users.role,
                    users.department_id,
                    users.full_name,
                    departments.name AS department_name
                FROM users
                LEFT JOIN departments
                    ON users.department_id = departments.id
                ORDER BY users.username
                `
            );

            return res.json({
                users
            });

        } catch (error) {

            console.error(
                "Ошибка получения пользователей:",
                error
            );

            return res.status(500).json({
                error: "Ошибка сервера"
            });
        }
    }
);

// =====================================================
// CREATE USER
// =====================================================

app.post(
    "/api/users",
    authenticateToken,
    adminOnly,
    async (req, res) => {

        try {

            const {
                username,
                password,
                role,
                department_id,
                full_name
            } = req.body;

            if (
                !username ||
                !password ||
                !role ||
                !full_name
            ) {

                return res.status(400).json({
                    error:
                        "Заполните обязательные поля"
                });
            }

            if (
                role !== "admin" &&
                role !== "manager"
            ) {

                return res.status(400).json({
                    error: "Некорректная роль"
                });
            }

            const existingUser = getOne(
                `
                SELECT id
                FROM users
                WHERE username = ?
                `,
                [username.trim()]
            );

            if (existingUser) {

                return res.status(400).json({
                    error:
                        "Такой логин уже существует"
                });
            }

            const passwordHash =
                await bcrypt.hash(
                    password,
                    10
                );

            run(
                `
                INSERT INTO users
                (
                    username,
                    password,
                    role,
                    department_id,
                    full_name
                )
                VALUES (?, ?, ?, ?, ?)
                `,
                [
                    username.trim(),
                    passwordHash,
                    role,
                    department_id || null,
                    full_name.trim()
                ]
            );

            return res.status(201).json({
                message: "Пользователь создан"
            });

        } catch (error) {

            console.error(
                "Ошибка создания пользователя:",
                error
            );

            return res.status(500).json({
                error: "Ошибка сервера"
            });
        }
    }
);

// =====================================================
// API 404
// =====================================================

app.use("/api", (req, res) => {

    res.status(404).json({
        error: "API-метод не найден"
    });
});

// =====================================================
// START SERVER
// =====================================================

async function startServer() {

    try {

        console.log(
            "Инициализация базы данных..."
        );

        await initDatabase();

        console.log(
            "База данных готова."
        );

        app.listen(
    PORT,
    "0.0.0.0",
    () => {
        console.log("");
        console.log("=================================");
        console.log(`Сервер запущен: http://localhost:${PORT}`);
        console.log("Сервер доступен в локальной сети");
        console.log("=================================");
        console.log("");
        console.log("Демо-аккаунты:");
        console.log("admin / admin123");
        console.log("hr / hr123");
        console.log("sales / sales123");
        console.log("it / it123");
        console.log("finance / finance123");
        console.log("");
    }
);

    } catch (error) {

        console.error("");
        console.error(
            "================================="
        );

        console.error(
            "НЕ УДАЛОСЬ ЗАПУСТИТЬ СЕРВЕР"
        );

        console.error(
            "================================="
        );

        console.error(error);

        process.exit(1);
    }
}

startServer();