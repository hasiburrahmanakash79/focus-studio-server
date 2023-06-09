const express = require("express");
const cors = require("cors");
const app = express();
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();
const port = process.env.PORT || 5000;

// Middle ware
app.use(cors());
app.use(express.json());

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
    await client.connect();

    const usersCollection = client.db("focusStudio").collection("users");
    const classesCollection = client.db("focusStudio").collection("classes");
    const instructorsCollection = client.db("focusStudio").collection("instructors");

    app.get("/users", async(req, res) => {
      const result = await usersCollection.find().toArray()
      res.send(result)
    })
    
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = {email: user.email}
      const existingUser = await usersCollection.findOne(query);
      if(existingUser){
        return res.send([]);
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // classes
    app.get("/classes", async(req, res) => {
      const result = await classesCollection.find().toArray()
      res.send(result)
    })

    app.get("/instructors", async(req, res) => {
      const result = await instructorsCollection.find().toArray()
      res.send(result)
    })

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
