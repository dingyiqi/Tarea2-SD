const express = require("express");
const { Kafka } = require('kafkajs');

const port = process.env.PORT || 8081;
const app = express();

app.use(express.json());

const kafka = new Kafka({
    clientId: 'order-notify-service',
    brokers: [process.env.kafkaHost],
});

const ordersState = {};

const handleKafkaMessage = async ({ topic, partition, message }) => {
    try {
        console.log("Received Kafka message:", message.value.toString());
        if (message.value) {
            const data = JSON.parse(message.value.toString());
            console.log("Updated order:", data);
            ordersState[data.id] = data;
            console.log("Current ordersState:", ordersState);
        }
    } catch (error) {
        console.error("Error handling Kafka message:", error);
    }
};


const setupKafkaConsumer = async () => {
    const consumer = kafka.consumer({ groupId: 'order-notify-group' });

    consumer.on('consumer.crash', async () => {
        console.error("Kafka consumer crashed. Attempting to reconnect...");
        await consumer.disconnect();
        await setupKafkaConsumer();
    });

    try {
        await consumer.connect();
        console.log("Connected to Kafka and subscribed to 'notify' topic");
        await consumer.subscribe({ topic: 'notify' });
        console.log("Subscribed to 'notify' topic");
        await consumer.run({
            eachMessage: handleKafkaMessage,
        });
    } catch (error) {
        console.error("Error setting up Kafka consumer:", error);
    }
};


app.get("/order/:id", (req, res) => {
    const orderId = req.params.id;
    const order = ordersState[orderId];
    if (order) {
        res.status(200).json(order);
    } else {
        res.status(404).json({ message: "Order not found" });
    }
});


app.get("/orders", (req, res) => {
    const orders = Object.values(ordersState);
    res.status(200).json(orders);
});


app.listen(port, () => {
    console.log(`Listening on port ${port}`);
    setupKafkaConsumer().catch(error => {
        console.error("Error setting up Kafka consumer:", error);
    });
});
