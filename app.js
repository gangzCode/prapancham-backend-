const express = require('express');
require('dotenv/config');
const app = express();
const morgan = require('morgan');
const mongoose = require('mongoose');
const cors = require('cors');
//const { auth } = require('express-openid-connect');

//Uploaded image folder
app.use('/public', express.static('public'));

//middleware
app.use(cors());
app.options('*', cors());
//Auth 0 middleware
// app.use(
//     auth({
//       authRequired: false,
//       auth0Logout: true,
//       issuerBaseURL: process.env.ISSUER_BASE_URL,
//       baseURL: 'http://localhost:4000',
//       clientID: process.env.CLIENT_ID,
//       secret: process.env.SECRET,
//       idpLogout: true,
//     })
//   );


//Middleware
app.use(express.json());
app.use(morgan('tiny'));

//Routes
const newsLetterssRoutes = require('./routers/news-letters');
const userRoutes = require("./routers/user");
const authRoutes = require("./routers/auth");
const faqRoutes = require("./routers/faq");
const contactUsFormRoutes = require("./routers/contactUs-form");
const advertistmentRoutes = require("./routers/advertistment");
const eventRoutes = require("./routers/event");
const newsRoutes = require("./routers/news");
const obituaryRemembarancePackagesRoutes = require("./routers/obituaryRemembarance-packages");
const tributeItemsRoutes = require("./routers/tribute-items");

const api = process.env.API_URL;

app.use(`${api}/news-letters`, newsLetterssRoutes);
app.use(`${api}/auth`, authRoutes);
app.use(`${api}/user`, userRoutes);
app.use(`${api}/faq`, faqRoutes);
app.use(`${api}/contact-us`, contactUsFormRoutes);
app.use(`${api}/advertistment`, advertistmentRoutes);
app.use(`${api}/event`, eventRoutes);
app.use(`${api}/news`, newsRoutes);
app.use(`${api}/obituaryRemembarance-packages`, obituaryRemembarancePackagesRoutes);
app.use(`${api}/tribute-items`, tributeItemsRoutes);

app.get('/', (req,res,next) =>{
    res.send("hello gangez")
});

//const PORT = process.env.PORT || 4000;

// app.get('/', (req,res) =>{
//     res.send(req.oidc.isAuthenticated()? 'Logged in' : 'Logged out')
// })

// Database connection
let isConnected = false;
const connectToDB = async () => {
  if (isConnected) return;
  
  try {
    await mongoose.connect(process.env.CONNECTION_STRING, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      dbName: process.env.DB_NAME,
    });
    isConnected = true;
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection failed:', err);
    process.exit(1);
  }
};

// Connect to DB only once before handling requests
connectToDB();


module.exports = app;
