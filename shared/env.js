let dbPath = '';
let frontend = '';
let backend = '';

export const setDBPath = (val) => {
    dbPath = val;
};
export const getDBPath = () => dbPath;

export const setFrontendPath = (val) => {
    frontend = val;
};
export const getFrontendPath = () => frontend;

export const initEnv = () => {
    dbPath =
        process.env.MONGO_DB_URL || 'mongodb://127.0.0.1:27017/lexical-db ';
    frontend = process.env.FRONTEND_ADDRESS || 'http://hades.pc.com:3000/';
    backend = process.env.REACT_APP_API_URL || 'http://hades.pc.com:8000/';
};
