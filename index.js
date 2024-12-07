const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
app.use(cookieParser());
app.use(express.json());


app.use(cors({
  origin: [
    // "http://localhost:5173",
    "https://cars-doctor-f30d3.web.app",
    "https://cars-doctor-f30d3.firebaseapp.com"
  ]  ,
  credentials: true
}));
app.use(express.json());


const port = process.env.PORT || 3000;




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.c8gxc.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const logger = async (req, res, next) => {
  console.log("Called", req.host, req.originalUrl)
  next();
};

const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;
  console.log(token);
  if (!token) return res.status(401).send({ message: 'Access denied. No token provided.' });
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET,(err, decoded) => {
    if (err) return res.status(403).send({ message: 'Access denied.' });
    req.user = decoded;
    next();
  })

};

const cookeOption  = {
  httpOnly: true,
  sameSite: process.env.NODE_ENV === 'production' ? "none" : "strict",
  secure: process.env.NODE_ENV === 'production' ? true : false,
}

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const serviceCollection = client.db("carDoctor").collection("services");
    const orderCollection = client.db("carDoctor").collection("orders");

    // auth related api

    app.post("/jwt", logger, async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.cookie('token', token, cookeOption ).send({success: true});
    })

    app.post("/logout", logger, verifyToken, async (req, res) => {
      console.log("logged out", req.user);
      res.clearCookie('token',{...cookeOption, maxAge: 0});
      res.send({ success: true });
    })
    // 
    app.get("/services", logger,  async (req, res) => {
      const cursor = await serviceCollection.find().toArray();
      res.json(cursor);
    })

    app.get("/services/:id", async (req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const options = {
        // Sort matched documents in descending order by rating
        // Include only the `title` and `imdb` fields in the returned document
        projection: { title: 1, price: 1 ,service_id: 1, img: 1 },
      };
      const service = await serviceCollection.findOne(query, options);
      res.json(service);
    });

    // order by service
    app.post("/orders", async (req, res) => {
      const order = req.body;
      const result = await orderCollection.insertOne(order);
      res.json(result);
    })

    app.get("/orders",logger, verifyToken, async (req, res) => {
      console.log(req.query.email)
      console.log(req.user)
      if(req.query.email !== req.user.email){
        return res.status(403).json({message: "Forbidden Access"})
      }
      let query = {}
      if(req.query?.email){
        query = {email: req.query.email}
      }
      const order = await orderCollection.find(query).toArray();
      res.json(order);
    })

    app.patch("/orders/:id", async (req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const updatedOrder = req.body;
      const result = await orderCollection.updateOne(query, { $set: updatedOrder });
      res.json(result);
    })

    app.delete("/orders/:id", async (req, res) =>{
      const id = req.params.id;
      console.log(id)
      const query = {_id: new ObjectId(id)}
      const result = await orderCollection.deleteOne(query)
      res.json(result);
    })

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/api/data', (req, res) => {
    res.json({ message: 'Hello from server!' });
})

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});