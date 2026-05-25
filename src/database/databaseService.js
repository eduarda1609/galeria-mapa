import * as SQLite from 'expo-sqlite';

const obterBanco = async () => {
    return await SQLite.openDatabaseAsync('photos.db');
};

export const inicializarBanco = async () => {
    try {
        const db = await obterBanco();
        await db.execAsync(`
            CREATE TABLE IF NOT EXISTS photos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                image_uri TEXT NOT NULL,
                latitude REAL,
                longitude REAL,
                created_at TEXT NOT NULL
            );
        `);
        console.log("Banco pronto.");
    } catch (error) {
        console.error("Erro ao inicializar:", error);
        throw error;
    }
};

export const salvarFoto = async (title, imageUri, latitude, longitude) => {
    try {
        const db = await obterBanco();
        const dataAtual = new Date().toLocaleString('pt-BR');
        const resultado = await db.runAsync(
            'INSERT INTO photos (title, image_uri, latitude, longitude, created_at) VALUES (?, ?, ?, ?, ?);',
            title, imageUri, latitude, longitude, dataAtual
        );
        return resultado.lastInsertRowId;
    } catch (error) {
        throw error;
    }
};

export const listarFotos = async () => {
    try {
        const db = await obterBanco();
        return await db.getAllAsync('SELECT * FROM photos ORDER BY id DESC;');
    } catch (error) {
        return [];
    }
};

export const excluirFoto = async (id) => {
    try {
        const db = await obterBanco();
        await db.runAsync('DELETE FROM photos WHERE id = ?;', id);
    } catch (error) {
        throw error;
    }
};

// --- NOVIDADE: FUNÇÃO DE ATUALIZAR (EXTRA DO TRABALHO) ---
export const editarFoto = async (id, novoTitulo) => {
    try {
        const db = await obterBanco();
        // UPDATE atualiza apenas o título onde o ID for igual ao da foto escolhida
        await db.runAsync('UPDATE photos SET title = ? WHERE id = ?;', novoTitulo, id);
    } catch (error) {
        throw error;
    }
};