const formData = require('form-data');
const Mailgun = require('mailgun.js');
const generateReport = require("../report/generate-report");
const fs = require("fs");
const {User} = require("../models/user");
const {Order} = require("../models/user");
const mailgun = new Mailgun(formData);

const API_KEY = process.env.MAILGUN_API_KEY
const API_DOMAIN = process.env.MAILGUN_API_DOMAIN
const SENDER_EMAIL = process.env.MAILGUN_API_SENDER
const CONTACT_US_RECEIVER_EMAIL = process.env.CONTACT_US_RECEIVER_EMAIL

const mg = mailgun.client({
    username: 'api',
    key: API_KEY,
});

function sendEmail() {
    mg.messages
        .create(API_DOMAIN, {
            from: SENDER_EMAIL,
            to: ["no.reply4gtech@gmail.com"],
            subject: "Hello",
            text: "Testing some Mailgun awesomness!",
        })
        .then(msg => console.log(msg)) // logs response data
        .catch(err => console.log(err)); // logs any error`;

}

async function sendOrderPlacedEmail(orderId) {
    try {
        const order = await Order.findById(orderId).populate('address').populate('orderItems.itemId',
            {_id: 1, name: 1, isNumericVariation: 1});
        let adminEmails = [];
        const adminUsers = await User.find({isAdmin: true});
        for (let user of adminUsers) {
            adminEmails.push(user.email);
        }
        const fsPromises = require('fs').promises;
        const path = require('path');
        let fileName = (order._id + '.pdf');
        const filepath = path.resolve(__dirname, './generated_reports/' + fileName);
        let messageParams = {
            from: SENDER_EMAIL,
            to: order.username,
            bcc: adminEmails,
            subject: "Order has been placed",
            text: "Please find your invoice in attachments.",
        }
        generateReport(fileName, order, true);
        fsPromises.readFile(filepath)
            .then(data => {
                messageParams.attachment = {
                    filename: 'order-invoice.pdf',
                    data
                };
                return mg.messages.create(API_DOMAIN, messageParams);
            })
            .then(response => {
                console.log(response);
                fs.unlink(filepath, (err) => {
                    if (err) {
                        console.error(err);
                    }
                });
            }).catch(err => {
            console.error(err)
        })
    } catch (e) {
        console.error(e)
    }
}

async function sendContactUsEmail(name, email, contact, message) {
    await mg.messages.create(API_DOMAIN, {
        from: SENDER_EMAIL,
        to: [CONTACT_US_RECEIVER_EMAIL],
        subject: "Hello",
        text: `NAME\t : ${name}\nEMAIL\t  : ${email}\nPHONE\t: ${contact}\n\nMESSAGE:\n${message}`,
    })
}

module.exports = {sendEmail, sendOrderPlacedEmail, sendContactUsEmail};
