import mongoose from 'mongoose';

const Schema = mongoose.Schema;

const CoreSchema = new Schema({
    key: { type: String, required: true, unique: true },
    value: { type: String, default: '' },
    changelog: [{ type: String, default: '' }],
});

const CoreModel = mongoose.model('Core', CoreSchema);

export default CoreModel;
