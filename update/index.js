const { Kafka } = require('kafkajs');

const kafka = new Kafka({
    clientId: 'order-update-service',
    brokers: [process.env.kafkaHost],
});

const producer = kafka.producer();

const updateOrderStatus = (order) => {
    if (order.status === 'received') {
        order.status = 'preparing';
    } else if (order.status === 'preparing') {
        order.status = 'delivering';
    } else if (order.status === 'delivering') {
        order.status = 'completed';
    }
    return order;
};

const updateAutomatic = async () => {
    const consumer = kafka.consumer({ groupId: 'order-update-group' });

    try {
        await consumer.connect();
        await producer.connect();

        await consumer.subscribe({ topic: 'update_order' });

        await consumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                const order = JSON.parse(message.value.toString());
                const updatedOrder = updateOrderStatus(order);

                console.log("Updating order:", updatedOrder);

                if (updatedOrder.status !== 'completed') {
                    await producer.send({
                        topic: 'update_order',
                        messages: [{ value: JSON.stringify(updatedOrder) }],
                    });
                } else {
                    await producer.send({
                        topic: 'completed_order',
                        messages: [{ value: JSON.stringify(updatedOrder) }],
                    });

                    await producer.send({
                        topic: 'notify',
                        messages: [{ value: JSON.stringify(updatedOrder) }],
                    });
                }
            },
        });
    } catch (error) {
        console.error('Error connecting and consuming from Kafka:', error);
    }
};

updateAutomatic();

process.on('SIGINT', async () => {
    try {
        await producer.disconnect();
    } catch (error) {
        console.error('Error disconnecting producer:', error);
    }
    process.exit();
});
