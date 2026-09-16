const fs = require("fs");
const path = require("path");
const initSqlJs = require("sql.js");
const bcrypt = require("bcryptjs");

const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "database.sqlite");

let db;

async function initDatabase() {
    const SQL = await initSqlJs();

    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(DB_FILE)) {
        const file = fs.readFileSync(DB_FILE);
        db = new SQL.Database(file);
    } else {
        db = new SQL.Database();
    }

    createTables();
    seedDatabase();
    saveDatabase();

    return db;
}

function createTables() {
    db.run(`
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS departments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE
        );

        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('admin', 'manager')),
            department_id INTEGER,
            full_name TEXT,
            FOREIGN KEY (department_id)
                REFERENCES departments(id)
                ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS employees (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name TEXT NOT NULL,
            position TEXT,
            department_id INTEGER NOT NULL,
            status TEXT NOT NULL,
            email TEXT,
            phone TEXT,
            comment TEXT,
            FOREIGN KEY (department_id)
                REFERENCES departments(id)
                ON DELETE RESTRICT
        );
    `);
}

function getOne(sql, params = []) {
    const stmt = db.prepare(sql);

    try {
        stmt.bind(params);

        if (stmt.step()) {
            return stmt.getAsObject();
        }

        return null;
    } finally {
        stmt.free();
    }
}

function getAll(sql, params = []) {
    const stmt = db.prepare(sql);
    const result = [];

    try {
        stmt.bind(params);

        while (stmt.step()) {
            result.push(stmt.getAsObject());
        }

        return result;
    } finally {
        stmt.free();
    }
}

function run(sql, params = []) {
    db.run(sql, params);
    saveDatabase();
}

function getLastInsertId() {
    const result = db.exec("SELECT last_insert_rowid() AS id");

    if (!result.length || !result[0].values.length) {
        return null;
    }

    return result[0].values[0][0];
}

function saveDatabase() {
    if (!db) {
        return;
    }

    const data = db.export();
    fs.writeFileSync(DB_FILE, Buffer.from(data));
}

function seedDatabase() {
    const departmentCount = getOne(
        "SELECT COUNT(*) AS count FROM departments"
    );

    if (Number(departmentCount.count) === 0) {
        run(`
            INSERT INTO departments (name)
            VALUES
                ('HR'),
                ('Продажи'),
                ('IT'),
                ('Финансы')
        `);
    }

    const userCount = getOne(
        "SELECT COUNT(*) AS count FROM users"
    );

    if (Number(userCount.count) === 0) {
        const departments = getAll(
            "SELECT id, name FROM departments"
        );

        const departmentMap = {};

        departments.forEach((department) => {
            departmentMap[department.name] = department.id;
        });

        const users = [
            {
                username: "admin",
                password: "admin123",
                role: "admin",
                department_id: null,
                full_name: "Администратор системы"
            },
            {
                username: "hr",
                password: "hr123",
                role: "manager",
                department_id: departmentMap["HR"],
                full_name: "Руководитель HR"
            },
            {
                username: "sales",
                password: "sales123",
                role: "manager",
                department_id: departmentMap["Продажи"],
                full_name: "Руководитель продаж"
            },
            {
                username: "it",
                password: "it123",
                role: "manager",
                department_id: departmentMap["IT"],
                full_name: "Руководитель IT"
            },
            {
                username: "finance",
                password: "finance123",
                role: "manager",
                department_id: departmentMap["Финансы"],
                full_name: "Руководитель финансов"
            }
        ];

        users.forEach((user) => {
            const hash = bcrypt.hashSync(user.password, 10);

            run(
                `
                INSERT INTO users
                    (username, password, role, department_id, full_name)
                VALUES (?, ?, ?, ?, ?)
                `,
                [
                    user.username,
                    hash,
                    user.role,
                    user.department_id,
                    user.full_name
                ]
            );
        });
    }

    const employeeCount = getOne(
        "SELECT COUNT(*) AS count FROM employees"
    );

    if (Number(employeeCount.count) === 0) {
        const departments = getAll(
            "SELECT id, name FROM departments"
        );

        const departmentMap = {};

        departments.forEach((department) => {
            departmentMap[department.name] = department.id;
        });

        const employees = [
            [
                "Иванов Иван Иванович",
                "HR-специалист",
                departmentMap["HR"],
                "На работе",
                "ivanov@example.com",
                "+7 900 111-11-11",
                ""
            ],
            [
                "Петрова Анна Сергеевна",
                "Менеджер по подбору",
                departmentMap["HR"],
                "В отпуске",
                "petrova@example.com",
                "+7 900 222-22-22",
                "До 25 числа"
            ],
            [
                "Сидоров Алексей Дмитриевич",
                "Менеджер по продажам",
                departmentMap["Продажи"],
                "На работе",
                "sidorov@example.com",
                "+7 900 333-33-33",
                ""
            ],
            [
                "Кузнецова Мария Андреевна",
                "Продавец",
                departmentMap["Продажи"],
                "На больничном",
                "kuznetsova@example.com",
                "+7 900 444-44-44",
                ""
            ],
            [
                "Смирнов Дмитрий Олегович",
                "Frontend-разработчик",
                departmentMap["IT"],
                "Удалённая работа",
                "smirnov@example.com",
                "+7 900 555-55-55",
                ""
            ],
            [
                "Волкова Елена Павловна",
                "Системный администратор",
                departmentMap["IT"],
                "Командировка",
                "volkova@example.com",
                "+7 900 666-66-66",
                "Москва"
            ],
            [
                "Морозов Андрей Сергеевич",
                "Бухгалтер",
                departmentMap["Финансы"],
                "На работе",
                "morozov@example.com",
                "+7 900 777-77-77",
                ""
            ],
            [
                "Фёдорова Ольга Викторовна",
                "Финансовый менеджер",
                departmentMap["Финансы"],
                "Уволен",
                "fedorova@example.com",
                "+7 900 888-88-88",
                ""
            ]
        ];

        employees.forEach((employee) => {
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
                employee
            );
        });
    }

    saveDatabase();
}

module.exports = {
    initDatabase,
    getOne,
    getAll,
    run,
    getLastInsertId,
    saveDatabase
};