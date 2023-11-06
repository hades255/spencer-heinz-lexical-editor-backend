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
            return names[0] + ' and ' + names[1];
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
        await transporter.sendMail(mail);
    } catch (error) {
        console.error('Email Error: ', error);
    }
};

export const sendInvitationEmailToExist = (from, to, doc) => {
    setTimeout(() => {
        sendEmail({
            from: process.env.SERVER_MAIL_ADDRESS,
            to: to.email,
            subject: `${from.name} invited you to his document.`,
            html: `
            <div style="display: flex; justify-content: center">
              <div
                style="
                  max-width: 600px;
                  border: 2px solid #1677ff;
                  padding: 12px;
                  border-radius: 20px;
                  background-color: lightblue;
                "
              >
                <h4 style="text-align: center">
                  <a
                    title="${from.email}"
                    href="mailto:${from.email}"
                    style="text-decoration: none"
                    >${from.name}</a
                  >
                  invited you to document.
                </h4>
                <hr style="border: 1px solid #1677ff; border-radius: 1px" />
                <p><b>Title:</b> ${doc.name}</p>
                <p>
                  <b>Description: </b> ${doc.description}
                </p>
                <hr style="border: 1px solid #1677ff; border-radius: 1px" />
                <br />
                <div style="display: flex; justify-content: center">
                  <div>
                    Click
                    <a
                      href="${process.env.FRONTEND_ADDRESS || ''}/document/${
                          doc._id
                      }?email=${to.email}"
                      style="
                        padding: 8px;
                        background-color: #1677ff;
                        color: white;
                        border-radius: 8px;
                        text-decoration: none;
                      "
                      >HERE</a
                    >
                    to contribute!
                  </div>
                </div>
              </div>
            </div>`,
        });
    }, 100);
};
export const sendInvitationEmailToNew = (from, to, doc, token) => {
    setTimeout(() => {
        sendEmail({
            from: process.env.SERVER_MAIL_ADDRESS,
            to: to.email,
            subject: `${from.name} invited you to his document.`,
            html: `<div style="display: flex; justify-content: center">
            <div
              style="
                max-width: 600px;
                border: 2px solid #1677ff;
                padding: 12px;
                border-radius: 20px;
                background-color: lightblue;
              "
            >
              <h4 style="text-align: center">
                <a
                  title="${from.email}"
                  href="mailto:${from.email}"
                  style="text-decoration: none"
                  >${from.name}</a
                >
                invited you to document.
              </h4>
              <hr style="border: 1px solid #1677ff; border-radius: 1px" />
              <p><b>Title:</b> ${doc.name}</p>
              <p>
                <b>Description: </b> ${doc.description}
              </p>
              <hr style="border: 1px solid #1677ff; border-radius: 1px" />
              <br />
              <div style="display: flex; justify-content: center">
                <div>
                  Click
                  <a
                    href="${
                        process.env.FRONTEND_ADDRESS || ''
                    }/invites/${token}"
                    style="
                      padding: 8px;
                      background-color: #1677ff;
                      color: white;
                      border-radius: 8px;
                      text-decoration: none;
                    "
                    >HERE</a
                  >
                  to contribute!
                </div>
              </div>
            </div>
          </div>`,
        });
    }, 100);
};

export const findCommonElementsByKey = (arr1, arr2, key = '_id') => {
    const commonElements = arr1.filter((obj1) =>
        arr2.some((obj2) => obj2[key] === obj1[key]),
    );
    return commonElements;
};
export const compareArrays = (A, B, key = '_id') => {
    const elementsOnlyInA = A.filter(
        (objA) => !B.some((objB) => objB[key] === objA[key]),
    );
    return elementsOnlyInA;
};
