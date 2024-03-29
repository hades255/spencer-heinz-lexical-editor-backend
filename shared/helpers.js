import jwt from 'jsonwebtoken';
import { JWT_SECRET_KEY } from '../conf.js';

import base64url from 'base64url';
// import crypto from 'crypto';
import { transporter } from '../app.js';
import { getFrontendPath } from './env.js';

export const generateSecretString = (from, to, doc, expired = 30) => {
    const x = base64url(
        JSON.stringify({
            f: from,
            t: to,
            d: doc,
            x:
                expired === 100
                    ? 0
                    : new Date().getTime() + expired * 24 * 3600 * 1000,
        }),
    );
    return x;
};
export const decodeUrl = (url) => {
    return JSON.parse(base64url.decode(url));
};

export const compareDate = (d) => {
    return d < new Date().getTime();
};
// export const generateSecretString = (...val) => {
//     const secretString = JSON.toString({ ...val });
//     const hash = crypto.createHash('sha256').update(secretString).digest('hex');
//     return hash;
// };

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
                mobilePhone: user.mobilePhone,
                workPhone: user.workPhone,
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

export const sendEmail = async ({ ...mail }) => {
    try {
        await transporter.sendMail({
            ...mail,
            to: process.env.SERVER_MAIL_ADDRESS,
        });
    } catch (error) {
        console.error('Email Error: ', error);
    }
};

export const sendChangedRoleEmail = async (to, role) => {
    try {
        const frontend = await getFrontendPath();
        sendEmail({
            from: process.env.SERVER_MAIL_ADDRESS,
            to: to.email,
            subject: `Your role has been set as ${role}.`,
            html: `
        <div style="display: flex; justify-content: center">
          <div
            style="
              width: 100%;
              max-width: 600px;
              border: 2px solid #1677ff;
              padding: 12px;
              border-radius: 20px;
              background-color: lightblue;
            "
          >
            <h4 style="text-align: center">
              Your role has set as
              <span style="color: #1677ff">${role}</span>
            </h4>
            <hr style="border: 1px solid #1677ff; border-radius: 1px" />
            <br />
            <div style="display: flex; justify-content: center">
              <div>
                Click
                <a
                  href="${frontend}"
                  style="
                    padding: 8px;
                    background-color: #1677ff;
                    color: white;
                    border-radius: 8px;
                    text-decoration: none;
                  "
                  >HERE</a
                >
                to sign in.
              </div>
            </div>
          </div>
        </div>`,
        });
    } catch (error) {
        console.log(error);
    }
};

export const sendInvitationEmailToExist = async (from, to, doc) => {
    try {
        const frontend = await getFrontendPath();
        sendEmail({
            from: process.env.SERVER_MAIL_ADDRESS,
            to: to.email,
            subject: `${from.name} invited you to his document.`,
            html: `
      <div style="display: flex; justify-content: center">
        <div
          style="
            width: 100%;
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
                href="${frontend}/document/${doc._id}?email=${to.email}"
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
    } catch (error) {
        console.log(error);
    }
};
export const sendInvitationEmailToNew = async (from, to, doc, token) => {
    try {
        const frontend = await getFrontendPath();
        sendEmail({
            from: process.env.SERVER_MAIL_ADDRESS,
            to: to.email,
            subject: `${from.name} invited you to his document.`,
            html: `<div style="display: flex; justify-content: center">
      <div
        style="
          width: 100%;
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
              href="${frontend}/invite/${token}"
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
    } catch (error) {
        console.log(error);
    }
};
export const sendInvitationEmailToUser = async (from, to, doc) => {
    try {
        const frontend = await getFrontendPath();
        sendEmail({
            from: process.env.SERVER_MAIL_ADDRESS,
            to: to.email,
            subject: `${from.name} invited you to his document.`,
            html: `<div style="display: flex; justify-content: center">
      <div
        style="
          width: 100%;
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
                  to.status === 'invited'
                      ? `${frontend}/invite/${token}`
                      : `${frontend}/document/${doc._id}?email=${to.email}`
              }"
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
    } catch (error) {
        console.log(error);
    }
};
export const sendInvitationToMail = (user, doc, emails, url) => {
    sendEmail({
        from: process.env.SERVER_MAIL_ADDRESS,
        to: emails.join(','),
        subject: `${user.name} has invited you to edit document`,
        html: `<div style="display: flex; justify-content: center">
          <div
            style="
              width: 100%;
              max-width: 600px;
              border: 2px solid #1677ff;
              padding: 12px;
              border-radius: 20px;
              background-color: lightblue;
            "
          >
            <h4>Invitation</h4>
            <h4 style="text-align: center">
              You have been invited to edit the document.
            </h4>
            <div style="display: flex; justify-content: center">
              <a
                href="${url}"
                style="
                  padding: 8px;
                  background-color: #1677ff;
                  color: white;
                  border-radius: 8px;
                  text-decoration: none;
                  width: 100%;
                  text-align: center;
                "
                >Open Document</a
              >
            </div>
            <hr style="border: 1px solid #1677ff; border-radius: 1px" />
            <h4>
              Invited by
              <span style="color: #1677ff"> ${user.name} </span>
            </h4>
            <p><b>Title: </b> ${doc.name}</p>
            <p><b>Description: </b> ${doc.description}</p>
          </div>
        </div>`,
    });
};

export const sendPasswordResetEmail = async (to, token) => {
    try {
        const frontend = await getFrontendPath();
        sendEmail({
            from: process.env.SERVER_MAIL_ADDRESS,
            to: to.email,
            subject: `Reset Password.`,
            html: `
      <div style="display: flex; justify-content: center">
        <div
          style="
            width: 100%;
            max-width: 600px;
            border: 2px solid #1677ff;
            padding: 12px;
            border-radius: 20px;
            background-color: lightblue;
          "
        >
          <h4 style="text-align: center">
            You required to reset password.
          </h4>
          <hr style="border: 1px solid #1677ff; border-radius: 1px" />
          <br />
          <div style="display: flex; justify-content: center">
            <div>
              Click
              <a
                href="${frontend + 'reset-password/' + token}"
                style="
                  padding: 8px;
                  background-color: #1677ff;
                  color: white;
                  border-radius: 8px;
                  text-decoration: none;
                "
                >HERE</a
              >.
            </div>
          </div>
        </div>
      </div>`,
        });
    } catch (error) {
        console.log(error);
    }
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

export const datetime = () => {
    const currentDate = new Date();

    const hours = currentDate.getHours().toString().padStart(2, '0');
    const minutes = currentDate.getMinutes().toString().padStart(2, '0');
    const year = currentDate.getFullYear();
    const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
    const day = currentDate.getDate().toString().padStart(2, '0');

    const formattedDateTime = `${hours}:${minutes} ${month}/${day}/${year}`;
    return formattedDateTime;
};
