const express = require("express");
const cors = require("cors");
jwt = require("jsonwebtoken");
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);
const port = process.env.PORT || 5000;

// Middle ware
app.use(cors());
app.use(express.json());

// JWT token verify
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access" });
  }
  //bearer token
  const token = authorization.split(" ")[1];

  jwt.verify(token, process.env.SECRET_TOKEN, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

// MongoDB
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.xvcivem.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const usersCollection = client.db("focusStudio").collection("users");
    const classesCollection = client.db("focusStudio").collection("classes");
    const paymentCollection = client.db("focusStudio").collection("payments");
    const blogsCollection = client.db("focusStudio").collection("blogs");
    const paymentHistoryCollection = client
      .db("focusStudio")
      .collection("paymentHistory");
    const instructorsCollection = client
      .db("focusStudio")
      .collection("instructors");
    const addToCartCollection = client
      .db("focusStudio")
      .collection("addToCart");

    //JWT
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.SECRET_TOKEN, {
        expiresIn: "7d",
      });
      res.send({ token });
    });

    // get all user
    app.get("/users",  async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    // login user insert in database
    app.post("/users",  async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send([]);
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // verifyJWT, match email, & check admin
    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ admin: false });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === "admin" };
      res.send(result);
    });

    // find instructor from database
    app.get("/users/instructor/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ instructor: false });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { instructor: user?.role === "instructor" };
      res.send(result);
    });

    // delete user from database
    app.delete("/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    });

    // classes
    app.get("/classes", async (req, res) => {
      const result = await classesCollection.find().toArray();
      res.send(result);
    });

    // instructor can add class
    app.post("/classes", async (req, res) => {
      const addClass = req.body;
      const result = await classesCollection.insertOne(addClass);
      res.send(result);
    });

    // Find classes for individual email 
    app.get("/classes/:email", async (req, res) => {
      const email = req.params.email;
      if (!email) {
        res.send([]);
      }
      const query = { email: email };
      const result = await classesCollection.find(query).toArray();
      res.send(result);
    });

    app.patch('/classes/approve/:id', async(req, res) => {
      const id = req.params.id;
      const filterID = { _id: new ObjectId(id)}
      const updateDoc = {
        $set: {
          status: "approved",
        }
      }
      const result = await classesCollection.updateOne(filterID, updateDoc);
      res.send(result);
    });

    app.delete('/classes/:id', async(req, res) => {
      const id = req.params.id;
      const deleteID = {_id: new ObjectId(id)}
      const result = await classesCollection.deleteOne(deleteID)
      res.send(result)
    })

    // BLOGS
    app.get("/blogs", async (req, res) => {
      const result = await blogsCollection.find().toArray();
      res.send(result);
    });

    // instructor can add blogs
    app.post("/blogs", async (req, res) => {
      const addBlog = req.body;
      const result = await blogsCollection.insertOne(addBlog);
      res.send(result);
    });

    // Instructors
    app.get("/instructors", async (req, res) => {
      const result = await instructorsCollection.find().toArray();
      res.send(result);
    });

    // Make Admin
    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filterId = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(filterId, updateDoc);
      res.send(result);
    });

    // Make instructor
    app.patch("/users/instructor/:id", async (req, res) => {
      const id = req.params.id;
      const filterId = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "instructor",
        },
      };
      const result = await usersCollection.updateOne(filterId, updateDoc);
      res.send(result);
    });

    // add to cart api
    app.get("/carts", verifyJWT, async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([]);
      }
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ error: true, message: "no access" });
      }
      const query = { email: email };
      const result = await addToCartCollection.find(query).toArray();
      res.send(result);
    });

    // add to cart class
    app.post("/carts", async (req, res) => {
      const item = req.body;
      const query = { id: item.id, email: item.email };
      try {
        const findItem = await addToCartCollection.find(query).toArray();
        if (findItem.length === 0) {
          const result = await addToCartCollection.insertOne(item);
          res.send(result);
        } else {
          res.send(["you have all ready added"]);
        }
      } catch (error) {
        console.log(error);
      }
    });

    // Delete add to cart
    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await addToCartCollection.deleteOne(query);
      res.send(result);
    });

    // payment system
    app.post("/create-payment-intent",  async (req, res) => {
      const { price } = req.body;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.post("/payments", async (req, res) => {
      const payment = req.body;
      console.log(payment);
      const insertResult = await paymentCollection.insertOne(payment);

      const query = { _id: new ObjectId(payment.classID) };
      const insertHistory = await paymentHistoryCollection.insertOne(payment);
      const deleteResult = await addToCartCollection.deleteOne(query);

      res.send({ insertResult, insertHistory, deleteResult });
    });

    // payment History
    app.get("/history/:email", async (req, res) => {
      const email = req.params.email;
      if (!email) {
        res.send([]);
      }
      const query = { email: email };
      const result = await paymentHistoryCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/history/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const query = { _id: new ObjectId(id) };
      const result = await paymentHistoryCollection.findOne(query);
      res.send(result);
    });

    app.get("/history",  async (req, res) => {
      const result = await paymentHistoryCollection.find().toArray();
      res.send(result);
    });

    app.patch("/history/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filterId = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          certificate: "yes",
        },
      };
      console.log(updateDoc);
      const result = await paymentHistoryCollection.updateOne(filterId, updateDoc);
      res.send(result);
    });

    // update payment and increase available seat
    app.put("/payment_update/:id",  async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const query = { _id: new ObjectId(id) };
      console.log(query);
      const updateDoc = {
        $inc: { available_seat: -1 },
      };
      const findClass = await classesCollection.updateOne(query, updateDoc);
      console.log(findClass);
      res.send(findClass);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Focus Studio server!!!");
});

app.listen(port, () => {
  console.log(`Focus Studio is running on port ${port}`);
});
