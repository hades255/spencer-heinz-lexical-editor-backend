import PassPortLocal from 'passport-local';
import PassPortJwt from 'passport-jwt';
const JWTstrategy = PassPortJwt.Strategy;
const ExtractJWT = PassPortJwt.ExtractJwt;
const LocalStrategy = PassPortLocal.Strategy;

import UserModel from '../models/User.js';
import { JWT_SECRET_KEY } from '../conf.js';

export const initializeAuthSystem = async (passport) => {
    // register a serializer that stores the user object's id in the session ...
    passport.registerUserSerializer(async (user, request) => user.id);

    // ... and then a deserializer that will fetch that user from the database when a request with an id in the session arrives
    passport.registerUserDeserializer(async (id, request) => {
        return await UserModel.findById(id);
    });

    passport.use(
        'signup',
        new LocalStrategy(
            {
                usernameField: 'email',
                passwordField: 'password',
                session: false,
            },
            async (email, password, done) => {
                try {
                    // validation for email and password
                    const user = new UserModel();
                    user.email = email;
                    user.password = password;
                    return done(null, user, {
                        message: 'Registered Successfully',
                    });
                } catch (error) {
                    done(error);
                }
            },
        ),
    );

    passport.use(
        'login',
        new LocalStrategy(
            {
                usernameField: 'email',
                passwordField: 'password',
            },
            async (email, password, done) => {
                try {
                    const user = await UserModel.findOne({ email }).select(
                        '+password',
                    );

                    if (!user) {
                        return done(null, false, { message: 'User not found' });
                    }

                    const validate = await user.isValidPassword(
                        password,
                        user.password,
                    );

                    if (!validate) {
                        return done(null, false, { message: 'Wrong Password' });
                    }

                    return done(null, user);
                } catch (error) {
                    return done(error);
                }
            },
        ),
    );

    passport.use(
        'protected',
        new JWTstrategy(
            {
                secretOrKey: JWT_SECRET_KEY,
                jwtFromRequest: ExtractJWT.fromAuthHeaderAsBearerToken(),
            },
            async (token, done) => {
                try {
                    return done(null, token.user);
                } catch (error) {
                    done(error);
                }
            },
        ),
    );
};
