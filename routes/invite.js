import { transporter } from '../app.js';
import DocumentModel from '../models/Document.js';
import UserModel from '../models/User.js';
import InviteModel from '../models/invite.js';
import { HTTP_RES_CODE, USER_STATUS } from '../shared/constants.js';
import { createAuthToken } from '../shared/helpers.js';

const inviteRouter = (fastify, opts, done) => {
    fastify.get('/mail', async (request, reply) => {
        try {
            await transporter.sendMail({
                from: process.env.SERVER_MAIL_ADDRESS,
                to: 'hades.255@outlook.com',
                subject: `invited you to his document.`,
                html: `<a href="${process.env.FRONTEND_ADDRESS}">Click Here</a>`,
            });

            return reply.code(404).send({
                code: HTTP_RES_CODE.ERROR,
                message: 'no invitation found',
            });
        } catch (error) {
            console.log('invite@get-error:', error);
            return reply.code(500).send({
                code: HTTP_RES_CODE.ERROR,
                data: { error },
                message: 'Unexpected Server Error Occured.',
            });
        }
    });
    fastify.get('/mails', async (request, reply) => {
        try {
            let arr = [
                {
                    from: process.env.SERVER_MAIL_ADDRESS,
                    to: 'hades.255@outlook.com',
                    subject: `invited you to his document.`,
                    html: `<a href="${process.env.FRONTEND_ADDRESS}">Click Here</a>`,
                },
                {
                    from: process.env.SERVER_MAIL_ADDRESS,
                    to: 'hades.255@outlook.com',
                    subject: `invited you to his document.`,
                    html: `<a href="${process.env.FRONTEND_ADDRESS}">Click Here</a>`,
                },
                {
                    from: process.env.SERVER_MAIL_ADDRESS,
                    to: 'hades.255@outlook.com',
                    subject: `invited you to his document.`,
                    html: `<a href="${process.env.FRONTEND_ADDRESS}">Click Here</a>`,
                },
                {
                    from: process.env.SERVER_MAIL_ADDRESS,
                    to: 'hades.255@outlook.com',
                    subject: `invited you to his document.`,
                    html: `<a href="${process.env.FRONTEND_ADDRESS}">Click Here</a>`,
                },
                {
                    from: process.env.SERVER_MAIL_ADDRESS,
                    to: 'hades.255@outlook.com',
                    subject: `invited you to his document.`,
                    html: `<a href="${process.env.FRONTEND_ADDRESS}">Click Here</a>`,
                },
            ];
            const sendM = (mails) => {
                sendEmail(mails[mails.length - 1]);
                mails.pop();
                if (mails.length) {
                    setTimeout(() => {
                        sendM(mails);
                    }, [300]);
                }
            };
            setTimeout(() => {
                sendM(arr);
            }, [300]);

            return reply.code(404).send({
                code: HTTP_RES_CODE.ERROR,
                message: 'no invitation found',
            });
        } catch (error) {
            console.log('invite@get-error:', error);
            return reply.code(500).send({
                code: HTTP_RES_CODE.ERROR,
                data: { error },
                message: 'Unexpected Server Error Occured.',
            });
        }
    });
    fastify.get('/:token', async (request, reply) => {
        try {
            const invite = await InviteModel.findOne({
                token: request.params.token,
            });
            if (invite) {
                if (invite.status === 'done') {
                    return reply.send({
                        code: HTTP_RES_CODE.ERROR,
                        data: {
                            user: invite.contributor,
                            document: invite.document,
                            creator: invite.creator,
                        },
                        message: '',
                    });
                }
                const user = await UserModel.findById(invite.contributor._id);
                const document = await DocumentModel.findById(
                    invite.document._id,
                );
                return reply.send({
                    code: HTTP_RES_CODE.SUCCESS,
                    data: {
                        user,
                        document,
                        creator: invite.creator,
                    },
                    message: '',
                });
            }
            return reply.code(404).send({
                code: HTTP_RES_CODE.ERROR,
                message: 'no invitation found',
            });
        } catch (error) {
            console.log('invite@get-error:', error);
            return reply.code(500).send({
                code: HTTP_RES_CODE.ERROR,
                data: {},
                message: 'Unexpected Server Error Occured.',
            });
        }
    });

    fastify.post('/:token', async (request, reply) => {
        try {
            //  first, find invites which has current token
            const invite = await InviteModel.findOne({
                token: request.params.token,
            });
            //  if invite exists
            if (invite) {
                //  if user handled invite, don't work again
                if (invite.status === 'done') {
                    return reply.code(404).send({
                        code: HTTP_RES_CODE.ERROR,
                        message: '',
                    });
                }
                //  get user invited
                const user = await UserModel.findById(invite.contributor._id);
                //  set user's status as active, and pwd as inputed pwd
                user.status = USER_STATUS.ACTIVE;
                user.password = request.body.password;
                user.save();
                //  get document that invites the user
                // const document = await DocumentModel.findById(
                //     invite.document._id,
                // );
                // if (
                //     !document.contributors.find(
                //         (item) => item._id === invite.contributor._id,
                //     )
                // )
                //     document.contributors = [...document.contributors, user];
                // document.invites = document.invites.map((item) => ({
                //     ...item,
                //     reply:
                //         item._id.toString() ===
                //         invite.contributor._id.toString()
                //             ? 'accept'
                //             : item.reply,
                //     date:
                //         item._id.toString() ===
                //         invite.contributor._id.toString()
                //             ? new Date()
                //             : item.date,
                // }));
                // document.save();
                //  make user login
                const serviceToken = createAuthToken(user);
                //  set invite status
                invite.status = 'done';
                invite.save();
                return reply.send({
                    code: HTTP_RES_CODE.SUCCESS,
                    data: {
                        serviceToken,
                        // user,
                        // document: invite.document,
                    },
                    message: '',
                });
            }
            return reply.code(404).send({
                code: HTTP_RES_CODE.ERROR,
                message: 'no invitation found',
            });
        } catch (error) {
            console.log('invite@get-error:', error);
            return reply.code(500).send({
                code: HTTP_RES_CODE.ERROR,
                data: {},
                message: 'Unexpected Server Error Occured.',
            });
        }
    });
    done();
};

export default inviteRouter;
