const nodemailer = require("nodemailer");
const generateReport = require("../report/generate-report");
const fs = require("fs");
const { User } = require("../models/user");
const { Order } = require("../models/order");
const { AdminUser } = require("../models/adminUser");
const { Country } = require("../models/country");
const { Addon } = require("../models/addons");
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

const sendRegistrationVerificationEmail = async (to, code) => {
  const mailOptions = {
    from: `"Prapancham" <${process.env.SENDER_EMAIL}>`,
    to,
    subject: "Your Registration Verification Code",
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
      .populate("selectedPackage")
      .populate("selectedAddons")
      .populate("basePackagePrice.country")
      .populate("finalPrice.country")
      .lean();

    if (order.basePackagePrice?.country) {
      order.basePackagePrice.currencyCode = order.basePackagePrice.country.currencyCode || "CAD";
    }

    if (order.finalPrice?.country) {
      order.finalPrice.currencyCode = order.finalPrice.country.currencyCode || "CAD";
    }

    if (order.selectedPackage?.prices?.length) {
      const selectedCountryId = order.basePackagePrice.country._id.toString();

      const pkgPrice = order.selectedPackage.prices.find(
        (p) => p.country?.toString() === selectedCountryId
      );

      order.selectedPackage.price = pkgPrice?.price || 0;
      order.selectedPackage.currencyCode = order.basePackagePrice.currencyCode;
    }

    order.selectedAddons = order.selectedAddons.map((addon) => {
      const selectedCountryId = order.basePackagePrice.country._id.toString();

      const priceObj = addon?.prices?.find(
        (p) => p.country?.toString() === selectedCountryId
      );

      return {
        ...addon,
        price: priceObj?.price || 0,
        currencyCode: order.basePackagePrice.currencyCode,
      };
    });

    const adminUsers = await User.find({ isSuperAdmin: true });
    const adminEmails = adminUsers.map((u) => u.email);

    const fsPromises = require("fs").promises;
    const path = require("path");
    const fileName = `${order._id}.pdf`;
    const filepath = path.resolve(__dirname, "./generated_reports/", fileName);

    const messageParams = {
      from: SENDER_EMAIL,
      to: order.username,
      bcc: adminEmails,
      subject: "Your Purchase of Obituary Package is Successful & Your Obituary Post is Under Review",
      text: "Please find your invoice in attachments.",
    };

    await generateReport(fileName, order, true);

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
    const order = await Order.findById(orderId);


    let adminEmails = [];
    const adminUsers = await AdminUser.find({ isAdmin: true });
    for (let user of adminUsers) {
      adminEmails.push(user.email);
    }
    
    let messageParams = {
      from: SENDER_EMAIL,
      to: order.username,
      bcc: adminEmails,
      subject: "Prapancham Obituary Order Status Has Been Updated",
      html: `
        <div>Dear Customer,</div>
        <div></div>
        <div></div>
        <div>Your order status has been updated to ${order.orderStatus}</div>
        <div></div>
        <div></div>
        <div>Best Regards,</div>
        <div>Prapancham</div>
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
  sendRegistrationVerificationEmail
};
