import jwt from 'jsonwebtoken';
import { JWT_SECRET_KEY } from '../conf.js';
import * as Y from 'yjs';

import crypto from 'crypto';
import { transporter } from '../app.js';

export const generateSecretString = (a, b, c) => {
    const secretString = a + b + c;
    const hash = crypto.createHash('sha256').update(secretString).digest('hex');
    // const randomString = generateRandomString(64 - hash.length);

    return hash;
};

export const generateRandomString = (length) => {
    const characters =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let randomString = '';

    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        randomString += characters[randomIndex];
    }

    return randomString;
};

export const nameSentence = (names, suffix = ' other clients') => {
    switch (names.length) {
        case 0:
            return '';
        case 1:
            return names[0];
        case 2:
            return names[0] + ', ' + names[1];
        case 3:
            return names[0] + ', ' + names[1] + ' and ' + names[2];
        default:
            return (
                names[0] +
                ', ' +
                names[1] +
                ' and ' +
                (names.length - 2) +
                suffix
            );
    }
};

export const createAuthToken = (user, expireTime = '1d') => {
    const token = jwt.sign(
        {
            user: {
                _id: user._id,
                email: user.email,
                name: user.name,
                avatar: user.avatar,
                role: user.role,
                status: user.status,
            },
        },
        JWT_SECRET_KEY,
        {
            expiresIn: expireTime,
        },
    );
    return token;
};

export const getByValue = (map, searchValue) => {
    for (let [key, value] of map.entries()) {
        if (value === searchValue) return key;
    }
};

export const getDocNameByYDoc = (rooms, doc) => {
    for (let [key, value] of rooms.entries()) {
        if (value.yDoc === doc) return key;
    }
    return false;
};

export const sendEmail = async (mail) => {
    try {
        console.log(mail);
        await transporter.sendMail(mail);
        console.log('Email sent successfully!');
    } catch (error) {
        console.error('Email Error: ', error);
    }
};
