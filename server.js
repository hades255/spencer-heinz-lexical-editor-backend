import mongoose from 'mongoose';
import startApp from './app.js';
import { getDBPath, initEnv } from './shared/env.js';
initEnv();

process.on('uncaughtException', (err) => {
    console.log('UNCAUGHT EXCEPTION!!! shutting down...');
    console.log(err.name, err.message);
    process.exit(1);
});

/**
 * Run the server!
 */
// connect database
mongoose
    .connect(getDBPath(), {
        useUnifiedTopology: true,
        useNewUrlParser: true,
    })
    .then(() => {
        startApp()
            .then(() => {
                console.log('Server Successfully Initializied!');
            })
            .catch((error) => {
                console.log('Server-start-error:', error.message);
            });
    })
    .catch((error) => {
        console.log('MongoDB-connection-error:', error.message);
        return process.exit(1);
    });

mongoose.connection.on('connected', () => {
    console.log('Connected to MongoDB');
});

mongoose.connection.on('error', (error) => {
    console.log(error);
});
