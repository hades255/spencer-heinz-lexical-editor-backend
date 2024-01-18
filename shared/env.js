import CoreModel from '../models/Core.js';

let dbPath = '';
let frontend = '';
let backend = '';

export const setDBPath = (val) => {
    dbPath = val;
};
export const getDBPath = () => dbPath;

export const setFrontendPath = async (val) => {
    try {
        frontend = val;
        const coreVal = await CoreModel.findOne({ key: 'frontend' });
        await CoreModel.findOneAndUpdate(
            { key: 'frontend' },
            {
                value: val,
                changelog: coreVal
                    ? [...coreVal.changelog, new Date().toString()]
                    : [new Date().toString()],
            },
            { upsert: true, new: true },
        );
        return true;
    } catch (error) {
        console.log(error);
        return null;
    }
};
export const getFrontendPath = async () => {
    try {
        const val = await CoreModel.findOne({ key: 'frontend' });
        if (val) return val.value;
        else {
            await CoreModel.create({ key: 'frontend', value: frontend });
            return frontend;
        }
    } catch (error) {
        console.log(error);
        return frontend;
    }
};

export const initEnv = () => {
    dbPath =
        process.env.MONGO_DB_URL || 'mongodb://127.0.0.1:27017/lexical-db ';
    frontend = process.env.FRONTEND_ADDRESS || 'http://hades.pc.com:3000/';
    backend = process.env.REACT_APP_API_URL || 'http://hades.pc.com:8000/';
};
