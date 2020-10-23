const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const charitySchema = new Schema({
    //_id: mongoose.Schema.Types.ObjectId,
    email: { type: String, required: true },
    type_of_contributor: { type: String, required: true },
    business_unit: { type: String, required: true },
    contribution_amount_in_dollars: { type: Number, required: true },
    charity_name: { type: String, required: true },
    date: { type: String, required: true }
});

module.exports = mongoose.model('Charity', charitySchema);