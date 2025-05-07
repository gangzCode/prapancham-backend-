const nodemailer = require("nodemailer");
const generateReport = require("../report/generate-report");
const fs = require("fs");
const { User } = require("../models/user");
const { Order } = require("../models/user");

const SMTP_HOST = process.env.SMTP_HOST;
const SENDER_EMAIL = process.env.SENDER_EMAIL;
const RECEIVER_EMAIL = process.env.RECEIVER_EMAIL;
const SENDER_PASSWORD = process.env.SENDER_PASSWORD;
const CONTACT_US_RECEIVER_EMAIL = process.env.CONTACT_US_RECEIVER_EMAIL;

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: 465,
  secure: false, // Use `true` for port 465, `false` for all other ports
  auth: {
    user: SENDER_EMAIL,
    pass: SENDER_PASSWORD,
  },
});

const sendMail = async () => {
  const info = await transporter.sendMail({
    from: SENDER_EMAIL, // sender address
    to: RECEIVER_EMAIL, // list of receivers
    subject: "Hello ✔", // Subject line
    text: "Hello world?",
  });
};

async function sendContactUsEmail(name, email, contact, message) {
  await transporter.sendMail({
    from: SENDER_EMAIL,
    to: CONTACT_US_RECEIVER_EMAIL,
    subject: "Hello",
    text: `NAME\t : ${name}\nEMAIL\t  : ${email}\nPHONE\t: ${contact}\n\nMESSAGE:\n${message}`,
  });
}

async function sendOrderPlacedEmail(orderId) {
  try {
    const order = await Order.findById(orderId)
      .populate("address")
      .populate("orderItems.itemId", { _id: 1, name: 1, isNumericVariation: 1 });
    let adminEmails = [];
    const adminUsers = await User.find({ isAdmin: true });
    for (let user of adminUsers) {
      adminEmails.push(user.email);
    }
    const fsPromises = require("fs").promises;
    const path = require("path");
    let fileName = order._id + ".pdf";
    const filepath = path.resolve(__dirname, "./generated_reports/" + fileName);
    let messageParams = {
      from: SENDER_EMAIL,
      to: order.username,
      bcc: adminEmails,
      subject: "Order has been placed",
      text: "Please find your invoice in attachments.",
    };
    generateReport(fileName, order, true);
    fsPromises
      .readFile(filepath)
      .then((data) => {
        messageParams.attachments = [
          {
            filename: "order-invoice.pdf",
            content: data,
            // filename: "text1.txt",
            // content: "hello world!",
          },
        ];
        return transporter.sendMail(messageParams);
      })
      .then((response) => {
        console.log(response);
        fs.unlink(filepath, (err) => {
          if (err) {
            console.error(err);
          }
        });
      })
      .catch((err) => {
        console.error(err);
      });
  } catch (e) {
    console.error(e);
  }
}

async function sendOrderUpdateEmail(orderId) {
  try {
    const order = await Order.findById(orderId)
      .populate("address")
      .populate("orderItems.itemId", { _id: 1, name: 1, isNumericVariation: 1 });

    const statusEnum = {
      P: "Pending",
      PR: "Processing",
      S: "Shipped",
      D: "Delivered",
      F: "Completed",
      C: "Cancelled",
    };

    let adminEmails = [];
    const adminUsers = await User.find({ isAdmin: true });
    for (let user of adminUsers) {
      adminEmails.push(user.email);
    }
    
    let messageParams = {
      from: SENDER_EMAIL,
      to: order.username,
      bcc: adminEmails,
      subject: "Order has been updated",
      html: `
        <div>Your order status has been updated to ${statusEnum[order.status]}</div>
        <div></div>
        <div></div>
        <div>Thank you</div>
      `,
    };

    await transporter.sendMail(messageParams);
  } catch (e) {
    console.error(e);
  }
}

module.exports = {
  sendMail,
  sendOrderPlacedEmail,
  sendContactUsEmail,
  sendOrderUpdateEmail,
};
