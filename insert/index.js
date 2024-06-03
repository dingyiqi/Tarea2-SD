const express = require("express");
const { Kafka } = require('kafkajs');
const { v4: uuidv4 } = require('uuid');

const port = process.env.PORT || 8080;
const app = express();

app.use(express.json());

const kafka = new Kafka({
    clientId: 'order-service',
    brokers: [process.env.kafkaHost],
});

const producer = kafka.producer();
const orders = {};

app.post("/orders", async (req, res) => {
    const orderId = uuidv4();
    req.body.id = orderId;
    orders[orderId] = req.body;

    try {
        await producer.connect();
        await producer.send({
            topic: 'new_order',
            messages: [{ value: JSON.stringify(req.body) }],
        });
        await producer.disconnect();
        res.status(200).json({ status: 200, message: req.body });
    } catch (error) {
        console.error("Error sending message to Kafka:", error);
        res.status(500).json({ status: 500, error: "Internal Server Error" });
    }
});

app.get("/order/:id", (req, res) => {
    const orderId = req.params.id;
    const order = orders[orderId];
    if (order) {
        res.status(200).json(order);
    } else {
        res.status(404).json({ message: "Order not found" });
    }
});

app.listen(port, () => {
    console.log(`Listening on port ${port}`);
});
