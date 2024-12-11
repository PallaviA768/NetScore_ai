document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('search-form');
    const userInput = document.getElementById('user-input');
    const messagesContainer = document.getElementById('step-container');
    const micButton = document.getElementById('mic-button');
    let isListening = false;

    // Initialize speech recognition if supported
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = SpeechRecognition ? new SpeechRecognition() : null;

    // Function to display user query in the chat
    const displayUserQuery = (query) => {
        const userMessage = document.createElement('div');
        userMessage.classList.add('alert', 'alert-primary', 'text-end');
        userMessage.textContent = query;
        messagesContainer.appendChild(userMessage);
        scrollToBottom();
    };

    // Function to display chatbot response
    const displayBotResponse = (response) => {
        const botMessage = document.createElement('div');
        botMessage.classList.add('alert', 'alert-success', 'text-start');
        botMessage.innerHTML = response;
        messagesContainer.appendChild(botMessage);
        scrollToBottom();
    };

    // Scroll to the bottom of the messages container
    const scrollToBottom = () => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    };

    // Handle form submission
    const handleFormSubmit = async (question) => {
        if (!question) return;

        displayUserQuery(question);
        userInput.value = '';

        try {
            const response = await fetch('/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ question }),
            });

            const data = await response.json();

            if (data.error) {
                displayBotResponse(`Error: ${data.error}`);
            } else if (data.result) {
                if (typeof data.result === 'object') {
                    createTableFromJSON(data.result); // Render table for JSON response
                } else {
                    displayBotResponse(data.result); // Display plain text response
                }
            } else {
                displayBotResponse('No response received.');
            }
        } catch (error) {
            console.error('Error during fetch:', error);
            displayBotResponse('An error occurred while processing your request.');
        }
    };

    // Function to convert JSON to HTML table
    const createTableFromJSON = (json) => {
        const table = document.createElement('table');
        table.classList.add('table', 'table-bordered', 'table-hover');

        // Clear existing content before appending the table
        messagesContainer.innerHTML = '';

        if (Array.isArray(json) && typeof json[0] === 'object') {
            const headerRow = document.createElement('tr');
            Object.keys(json[0]).forEach((key) => {
                const th = document.createElement('th');
                th.textContent = key;
                headerRow.appendChild(th);
            });
            table.appendChild(headerRow);

            json.forEach((item) => {
                const row = document.createElement('tr');
                Object.values(item).forEach((value) => {
                    const td = document.createElement('td');
                    td.textContent = Array.isArray(value) ? value.join(', ') : value;
                    row.appendChild(td);
                });
                table.appendChild(row);
            });
        } else if (typeof json === 'object') {
            const keys = Object.keys(json);
            const values = Object.values(json);

            const headerRow = document.createElement('tr');
            keys.forEach((key) => {
                const th = document.createElement('th');
                th.textContent = key;
                headerRow.appendChild(th);
            });
            table.appendChild(headerRow);

            const row = document.createElement('tr');
            values.forEach((value) => {
                const td = document.createElement('td');
                td.textContent = Array.isArray(value) ? value.join(', ') : value;
                row.appendChild(td);
            });
            table.appendChild(row);
        } else {
            const row = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 1;
            td.textContent = 'Invalid JSON structure';
            row.appendChild(td);
            table.appendChild(row);
        }

        messagesContainer.appendChild(table);
        scrollToBottom();
    };

    // Toggle microphone listening
    const toggleListening = () => {
        if (!recognition) {
            alert('Your browser does not support Speech Recognition.');
            return;
        }

        if (isListening) {
            recognition.stop();
            micButton.classList.remove('pulse');
            isListening = false;
        } else {
            recognition.start();
            micButton.classList.add('pulse');
            isListening = true;

            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                userInput.value = transcript;
                handleFormSubmit(transcript);
            };

            recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                displayBotResponse('Speech recognition error occurred.');
                micButton.classList.remove('pulse');
                isListening = false;
            };

            recognition.onend = () => {
                micButton.classList.remove('pulse');
                isListening = false;
            };
        }
    };

    // Form submission event
    form.addEventListener('submit', (event) => {
        event.preventDefault();
        const question = userInput.value.trim();
        handleFormSubmit(question);
    });

    // Microphone button click event
    micButton.addEventListener('click', toggleListening);
});
