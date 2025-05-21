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

const generate6DigitCode = () => Math.floor(100000 + Math.random() * 900000).toString();

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: 465,
  secure: true, // Use `true` for port 465, `false` for all other ports
  auth: {
    user: SENDER_EMAIL,
    pass: SENDER_PASSWORD,
  },
});

const sendVerificationEmail = async (to, code) => {
  const mailOptions = {
    from: `"Prapancham" <${process.env.SENDER_EMAIL}>`,
    to,
    subject: "Your Verification Code",
    html: `<p>Your verification code is <b>${code}</b>. It will expire in 5 minutes.</p>`,
  };

  await transporter.sendMail(mailOptions);
};

async function sendContactUsEmail(name, email, contact, message) {
  await transporter.sendMail({
    from: `"YourApp" <${process.env.EMAIL_USER}>`,
    to,
    subject: "Your Verification Code",
    html: `<p>Your verification code is <b>${code}</b>. It will expire in 5 minutes.</p>`,
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
  sendVerificationEmail,
  generate6DigitCode,
  sendOrderPlacedEmail,
  sendContactUsEmail,
  sendOrderUpdateEmail,
};
