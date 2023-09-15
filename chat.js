const readline = require('readline');
const brain = require('brain.js');
const { QuickDB } = require('quick.db');

// Define the neural network
const model = new brain.recurrent.LSTM();
const db = new QuickDB();

(async () => {
    let modelData = await db.get('model');

    console.log('Model data:', modelData);

    model.fromJSON(modelData);

    // Start the chat
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    rl.setPrompt('You: ');
    rl.prompt();

    rl.on('line', (input) => {
        const output = model.run(input);

        console.log(`AI: ${output}`);

        rl.prompt();
    });
})();