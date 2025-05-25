import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, query, orderBy, onSnapshot, addDoc, setDoc, doc, getDocs, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Firebase configuration (FILLED WITH YOUR PROJECT DETAILS)
const firebaseConfig = {
    apiKey: "",
    authDomain: "re-dividers.firebaseapp.com",
    projectId: "re-dividers",
    storageBucket: "re-dividers.appspot.com",
    messagingSenderId: "253272309466",
    appId: "1:253272309466:web:YOUR_SPECIFIC_WEB_APP_ID_HERE", // IMPORTANT: Get this exact "App ID" from your Firebase Project Settings -> "Your apps" -> Web App. If you can't find it easily, the app might still work, but it's best to include.
    // measurementId: "G-XXXXXXXXXX" // Include if your project provided one
};

// Initialize Firebase
let app;
let auth;
let db;
let appId = "homophone-challenge-app-v1"; // Your specific application ID

// Instead of a single 'isAdmin' flag, we'll have specific permission flags
let canAdd = false;
let canDelete = false;
let canEdit = false;

let adminUids = new Set(); // Still useful to know who is an admin, even if specific permissions are detailed in document
let isAuthReady = false; // Flag to indicate if auth state has been determined
let currentUserId = null; // Store the current user's UID
let questionsData = []; // Store fetched questions

document.addEventListener('DOMContentLoaded', () => {
    initializeFirebase();

    // Event listener for the "Add New Question" form submission
    const newQuestionForm = document.getElementById('new-question-form');
    if (newQuestionForm) {
        newQuestionForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const questionNumber = parseInt(document.getElementById('new-question-number').value, 10);
            const sentence1 = document.getElementById('new-sentence-1').value;
            const sentence2 = document.getElementById('new-sentence-2').value;
            const inputId1 = document.getElementById('new-input-id-1').value;
            const inputId2 = document.getElementById('new-input-id-2').value;
            const answer1 = document.getElementById('new-answer-1').value;
            const answer2 = document.getElementById('new-answer-2').value;

            const newQuestion = {
                questionNumber: questionNumber,
                sentences: [sentence1, sentence2],
                inputIds: [inputId1, inputId2],
                answers_map: {
                    [inputId1]: answer1,
                    [inputId2]: answer2
                }
            };
            await window.saveQuestion(newQuestion);
        });
    }

    // Initial check for message container (if it exists)
    const messageContainer = document.getElementById('message-container');
    if (messageContainer) {
        // You can add default messages here if needed
    }
});


async function initializeFirebase() {
    try {
        console.log("Initializing Firebase...");
        app = initializeApp(firebaseConfig);
        console.log("Firebase app initialized:", app);

        auth = getAuth(app);
        console.log("Auth initialized:", auth);

        db = getFirestore(app);
        console.log("Firestore initialized:", db);

        // Listen for authentication state changes
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                // User is signed in
                currentUserId = user.uid;
                console.log("Firebase authenticated. User ID:", currentUserId);

                // Load user's specific admin permissions
                await loadAdminPermissions(currentUserId);

                // Show/hide admin form based on 'canAdd' status
                const adminForm = document.getElementById('admin-form');
                if (adminForm) {
                    adminForm.style.display = canAdd ? 'block' : 'none';
                }
                
                isAuthReady = true;
                await loadQuestions(); // Load questions after auth state is determined
            } else {
                // User is signed out, attempt anonymous sign-in
                currentUserId = null;
                // Reset permissions if no user is signed in
                canAdd = false;
                canDelete = false;
                canEdit = false;

                console.log("No user signed in. Attempting anonymous sign-in...");
                try {
                    await signInAnonymously(auth);
                    console.log("Signed in anonymously.");
                } catch (error) {
                    console.error("Error signing in anonymously:", error);
                    displayMessage(`Error during anonymous sign-in: ${error.message}`, "error");
                }
            }
        });
    } catch (error) {
        console.error("Error initializing Firebase:", error);
        displayMessage(`Firebase Initialization Error: ${error.message}`, "error");
    }
}

// Function to display messages to the user
function displayMessage(message, type = "info") {
    const messageContainer = document.getElementById('message-container');
    if (messageContainer) {
        messageContainer.textContent = message;
        messageContainer.className = `message ${type}`; // 'message info', 'message success', 'message error'
        setTimeout(() => {
            messageContainer.textContent = '';
            messageContainer.className = 'message';
        }, 5000); // Clear message after 5 seconds
    } else {
        console.warn("Message container not found. Message:", message);
    }
}

// Load Admin Permissions for the current user
async function loadAdminPermissions(uid) {
    if (!db) {
        console.error("Firestore not initialized for loading admin permissions.");
        return;
    }
    try {
        const adminDocRef = doc(db, `artifacts/${appId}/public/config/admins`, uid);
        const adminDocSnap = await getDoc(adminDocRef); // Use getDoc to fetch a single document

        if (adminDocSnap.exists()) {
            const data = adminDocSnap.data();
            canAdd = data.canAdd === true; // Ensure it's explicitly true
            canDelete = data.canDelete === true;
            canEdit = data.canEdit === true;
            console.log(`User ${uid} Permissions: Add=${canAdd}, Delete=${canDelete}, Edit=${canEdit}`);
        } else {
            // Not an admin, or admin document doesn't exist
            canAdd = false;
            canDelete = false;
            canEdit = false;
            console.log(`User ${uid} is not an admin or missing permissions document.`);
        }
    } catch (error) {
        console.error("Error loading admin permissions:", error);
        displayMessage(`Error loading admin permissions: ${error.message}`, "error");
    }
}


// Function to load and display questions from Firestore
async function loadQuestions() {
    if (!db || !isAuthReady) {
        console.warn("Firestore or Auth not ready for loading questions.");
        return;
    }

    try {
        const questionsColRef = collection(db, `artifacts/${appId}/public/data/homophone_questions`);
        const q = query(questionsColRef, orderBy("questionNumber"));

        onSnapshot(q, (snapshot) => {
            questionsData = []; // Clear previous data
            if (snapshot.empty) {
                console.log("Firestore collection is empty. Populating with initial hardcoded questions.");
                // Populate with hardcoded questions if the collection is empty
                const hardcodedQuestions = [
                    // Your hardcoded questions here
                    // EXAMPLE 1:
                    {
                        questionNumber: 1,
                        sentences: [
                            "I went to the store to ______ a loaf of bread.",
                            "The bird built its nest on a high ______ of the tree."
                        ],
                        inputIds: ["input_buy", "input_bough"],
                        answers_map: {
                            "input_buy": "buy",
                            "input_bough": "bough"
                        }
                    },
                    // EXAMPLE 2:
                    {
                        questionNumber: 2,
                        sentences: [
                            "The knight wore shiny ______.",
                            "Did you ______ the story I told you?"
                        ],
                        inputIds: ["input_armor", "input_armour"],
                        answers_map: {
                            "input_armor": "armor",
                            "input_armour": "armour"
                        }
                    },
                    {
                        questionNumber: 3,
                        sentences: [
                            "I need to ______ the table for dinner.",
                            "Don't ______ so much sugar in your coffee."
                        ],
                        inputIds: ["input_set", "input_stir"],
                        answers_map: {
                            "input_set": "set",
                            "input_stir": "stir"
                        }
                    },
                     {
                        questionNumber: 4,
                        sentences: [
                            "I need to ______ to the store.",
                            "I hope we don't ______ out of gas."
                        ],
                        inputIds: ["input_go", "input_run"],
                        answers_map: {
                            "input_go": "go",
                            "input_run": "run"
                        }
                    },
                    {
                        questionNumber: 5,
                        sentences: [
                            "The cat chased its ______.",
                            "Could you please ______ the story again?"
                        ],
                        inputIds: ["input_tail", "input_tell"],
                        answers_map: {
                            "input_tail": "tail",
                            "input_tell": "tell"
                        }
                    },
                     {
                        questionNumber: 6,
                        sentences: [
                            "My favorite color is ______.",
                            "The dog likes to ______ in the park."
                        ],
                        inputIds: ["input_blue", "input_blew"],
                        answers_map: {
                            "input_blue": "blue",
                            "input_blew": "blew"
                        }
                    },
                     {
                        questionNumber: 7,
                        sentences: [
                            "She has long, ______ hair.",
                            "The rabbit ran over the ______."
                        ],
                        inputIds: ["input_fair", "input_fare"],
                        answers_map: {
                            "input_fair": "fair",
                            "input_fare": "fare"
                        }
                    },
                    {
                        questionNumber: 8,
                        sentences: [
                            "I saw a ______ in the garden.",
                            "The sun's ______ shone brightly."
                        ],
                        inputIds: ["input_flower", "input_flour"],
                        answers_map: {
                            "input_flower": "flower",
                            "input_flour": "flour"
                        }
                    },
                    {
                        questionNumber: 9,
                        sentences: [
                            "I need to ______ the time.",
                            "We had to ______ for the show."
                        ],
                        inputIds: ["input_wait", "input_weight"],
                        answers_map: {
                            "input_wait": "wait",
                            "input_weight": "weight"
                        }
                    },
                    {
                        questionNumber: 10,
                        sentences: [
                            "The ______ is very cold.",
                            "I want to ______ my friend."
                        ],
                        inputIds: ["input_sea", "input_see"],
                        answers_map: {
                            "input_sea": "sea",
                            "input_see": "see"
                        }
                    }

                    // Add more hardcoded questions as needed
                ];

                hardcodedQuestions.forEach(async (q) => {
                    try {
                        // Use addDoc to let Firestore generate an ID
                        await addDoc(collection(db, `artifacts/${appId}/public/data/homophone_questions`), q);
                        console.log(`Hardcoded question ${q.questionNumber} added.`);
                    } catch (error) {
                        console.error(`Error adding hardcoded question ${q.questionNumber}:`, error);
                    }
                });
            } else {
                snapshot.forEach(doc => {
                    const q = { id: doc.id, ...doc.data() }; // Capture the Firestore document ID
                    questionsData.push(q);
                });
            }
            renderAllQuestions(); // Render questions after data is loaded/updated
        }, (error) => {
            console.error("Error loading questions from Firestore:", error);
            displayMessage(`Error loading questions: ${error.message}`, "error");
        });
    } catch (error) {
        console.error("Error setting up onSnapshot for questions:", error);
        displayMessage(`Error setting up questions listener: ${error.message}`, "error");
    }
}

// Function to render all questions
window.renderAllQuestions = () => {
    const questionsContainer = document.getElementById('questions-container');
    if (!questionsContainer) {
        console.error("Questions container not found!");
        return;
    }
    questionsContainer.innerHTML = ''; // Clear existing questions

    questionsData.forEach(q => {
        const questionDiv = document.createElement('div');
        questionDiv.className = 'question';

        q.sentences.forEach((sentence, sIdx) => {
            const p = document.createElement('p');
            if (sIdx === 0) {
                p.innerHTML = `<strong>${q.questionNumber}.</strong> ${sentence}`;
            } else {
                p.innerHTML = sentence;
            }
            questionDiv.appendChild(p);
        });

        // --- ADMIN BUTTONS (Edit & Delete) ---
        // Only show buttons if the user has specific permissions
        if (canEdit || canDelete) { // If user can edit OR delete, show the button container
            // Edit Button
            if (canEdit) {
                const editBtn = document.createElement('button');
                editBtn.textContent = 'Edit Question';
                editBtn.style.backgroundColor = '#007bff'; // Blue color for edit
                editBtn.style.color = 'white';
                editBtn.style.border = 'none';
                editBtn.style.padding = '8px 12px';
                editBtn.style.borderRadius = '4px';
                editBtn.style.cursor = 'pointer';
                editBtn.style.marginLeft = '10px';
                editBtn.style.marginTop = '10px';
                editBtn.onclick = () => window.startEditQuestion(q.id, questionDiv);
                questionDiv.appendChild(editBtn);
            }

            // Delete Button
            if (canDelete) {
                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = 'Delete Question';
                deleteBtn.style.backgroundColor = '#dc3545'; // Red color for delete
                deleteBtn.style.marginLeft = '10px';
                deleteBtn.style.marginTop = '10px';
                deleteBtn.onclick = () => window.deleteQuestion(q.id, q.questionNumber);
                questionDiv.appendChild(deleteBtn);
            }
        }
        // --- END ADMIN BUTTONS ---

        questionsContainer.appendChild(questionDiv);
    });
};


// Function to save a new question to Firestore
window.saveQuestion = async (newQuestion) => {
    // Permission check changed from isAdmin to canAdd
    if (!db || !isAuthReady || !canAdd) {
        console.error("Firestore not ready, not authenticated, or not authorized. Cannot save question.");
        displayMessage("Cannot save question: Not authorized or database not ready.", "error");
        return;
    }

    try {
        const questionsColRef = collection(db, `artifacts/${appId}/public/data/homophone_questions`);
        await addDoc(questionsColRef, newQuestion);
        console.log("Question saved to Firestore:", newQuestion);
        displayMessage("Question added successfully!", "success");

        // Clear the form fields after submission
        document.getElementById('new-question-form').reset();
    } catch (error) {
        console.error("Error saving question to Firestore:", error);
        displayMessage("Error saving question. Check security rules or console.", "error");
    }
};

// Function to delete a question from Firestore
window.deleteQuestion = async (questionDocId, questionNumber) => {
    // Permission check changed from isAdmin to canDelete
    if (!db || !isAuthReady || !canDelete) {
        console.error("Firestore not ready, not authenticated, or not authorized. Cannot delete question.");
        displayMessage("Cannot delete question: Not authorized or database not ready.", "error");
        return;
    }

    if (confirm(`Are you sure you want to delete Question ${questionNumber}? This cannot be undone.`)) {
        try {
            const questionRef = doc(db, `artifacts/${appId}/public/data/homophone_questions`, questionDocId);
            await deleteDoc(questionRef);
            console.log(`Question ${questionNumber} (ID: ${questionDocId}) deleted from Firestore.`);
            displayMessage(`Question ${questionNumber} deleted successfully!`, "success");
            // The onSnapshot listener will automatically re-render questions.
        } catch (error) {
            console.error("Error deleting question from Firestore:", error);
            displayMessage("Error deleting question. Check security rules or console.", "error");
        }
    }
};

// Function to start editing a question (replaces static text with input fields)
window.startEditQuestion = (questionDocId, questionDivElement) => {
    // Permission check changed from isAdmin to canEdit
    if (!canEdit) {
        displayMessage("You are not authorized to edit questions.", "error");
        return;
    }

    // Find the question data from the fetchedQuestions array
    const qToEdit = questionsData.find(q => q.id === questionDocId);
    if (!qToEdit) {
        console.error("Question not found for editing:", questionDocId);
        displayMessage("Error: Question not found for editing.", "error");
        return;
    }

    // Clear the existing content of the questionDiv
    questionDivElement.innerHTML = '';
    questionDivElement.style.padding = '15px'; // Add some padding for the form
    questionDivElement.style.border = '1px solid #ccc'; // Add a border

    // Create input fields for questionNumber
    const numLabel = document.createElement('label');
    numLabel.textContent = 'Question Number: ';
    const numInput = document.createElement('input');
    numInput.type = 'number';
    numInput.value = qToEdit.questionNumber;
    numInput.id = `edit_question_number_${questionDocId}`; // Unique ID for this input
    questionDivElement.appendChild(numLabel);
    questionDivElement.appendChild(numInput);
    questionDivElement.appendChild(document.createElement('br')); // New line

    // Create input fields for sentences, inputIds, and answers
    qToEdit.sentences.forEach((sentence, sIdx) => {
        const sLabel = document.createElement('label');
        sLabel.textContent = `Sentence ${sIdx + 1}: `;
        const sInput = document.createElement('input');
        sInput.type = 'text';
        sInput.value = sentence;
        sInput.style.width = 'calc(100% - 120px)'; // Adjust width
        sInput.id = `edit_sentence_${sIdx}_${questionDocId}`; // Unique ID
        questionDivElement.appendChild(sLabel);
        questionDivElement.appendChild(sInput);
        questionDivElement.appendChild(document.createElement('br'));

        // Corresponding inputId and answer
        const inputId = qToEdit.inputIds[sIdx];
        const answer = qToEdit.answers_map[inputId];

        const idLabel = document.createElement('label');
        idLabel.textContent = `Input ID ${sIdx + 1}: `;
        const idInput = document.createElement('input');
        idInput.type = 'text';
        idInput.value = inputId;
        idInput.id = `edit_input_id_${sIdx}_${questionDocId}`; // Unique ID
        idInput.style.width = 'calc(50% - 80px)'; // Adjust width
        questionDivElement.appendChild(idLabel);
        questionDivElement.appendChild(idInput);

        const ansLabel = document.createElement('label');
        ansLabel.textContent = `Answer ${sIdx + 1}: `;
        const ansInput = document.createElement('input');
        ansInput.type = 'text';
        ansInput.value = answer;
        ansInput.id = `edit_answer_${sIdx}_${questionDocId}`; // Unique ID
        ansInput.style.width = 'calc(50% - 80px)'; // Adjust width
        ansInput.style.marginLeft = '10px';
        questionDivElement.appendChild(ansLabel);
        questionDivElement.appendChild(ansInput);
        questionDivElement.appendChild(document.createElement('br'));
        questionDivElement.appendChild(document.createElement('br')); // Extra new line
    });


    // Add Save and Cancel buttons
    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save Changes';
    saveBtn.style.backgroundColor = '#28a745'; // Green for save
    saveBtn.style.color = 'white';
    saveBtn.style.border = 'none';
    saveBtn.style.padding = '10px 15px';
    saveBtn.style.borderRadius = '4px';
    saveBtn.style.cursor = 'pointer';
    saveBtn.style.marginTop = '10px';
    saveBtn.onclick = () => window.saveEditedQuestion(questionDocId, questionDivElement);
    questionDivElement.appendChild(saveBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel Edit';
    cancelBtn.style.backgroundColor = '#6c757d'; // Gray for cancel
    cancelBtn.style.color = 'white';
    cancelBtn.style.border = 'none';
    cancelBtn.style.padding = '10px 15px';
    cancelBtn.style.borderRadius = '4px';
    cancelBtn.style.cursor = 'pointer';
    cancelBtn.style.marginLeft = '10px';
    cancelBtn.style.marginTop = '10px';
    cancelBtn.onclick = () => window.cancelEdit(questionDivElement); // We just need the element to re-render
    questionDivElement.appendChild(cancelBtn);
};

// Function to save the edited question to Firestore
window.saveEditedQuestion = async (questionDocId, questionDivElement) => {
    // Permission check changed from isAdmin to canEdit
    if (!db || !isAuthReady || !canEdit) {
        console.error("Firestore not ready, not authenticated, or not authorized. Cannot save edits.");
        displayMessage("Cannot save edits: Not authorized or database not ready.", "error");
        return;
    }

    try {
        // Retrieve values from the dynamically created input fields using their unique IDs
        const updatedQuestionNumber = parseInt(document.getElementById(`edit_question_number_${questionDocId}`).value, 10);
        const updatedSentence0 = document.getElementById(`edit_sentence_0_${questionDocId}`).value;
        const updatedSentence1 = document.getElementById(`edit_sentence_1_${questionDocId}`).value;
        const updatedInputId0 = document.getElementById(`edit_input_id_0_${questionDocId}`).value;
        const updatedInputId1 = document.getElementById(`edit_input_id_1_${questionDocId}`).value;
        const updatedAnswer0 = document.getElementById(`edit_answer_0_${questionDocId}`).value;
        const updatedAnswer1 = document.getElementById(`edit_answer_1_${questionDocId}`).value;

        // Construct the updated question object
        const updatedQuestionData = {
            questionNumber: updatedQuestionNumber,
            sentences: [updatedSentence0, updatedSentence1],
            inputIds: [updatedInputId0, updatedInputId1],
            answers_map: {
                [updatedInputId0]: updatedAnswer0,
                [updatedInputId1]: updatedAnswer1,
            }
        };

        // Get a reference to the specific document
        const questionRef = doc(db, `artifacts/${appId}/public/data/homophone_questions`, questionDocId);

        // Update the document in Firestore
        await updateDoc(questionRef, updatedQuestionData);
        console.log(`Question ${updatedQuestionNumber} (ID: ${questionDocId}) updated successfully.`);
        displayMessage(`Question ${updatedQuestionNumber} updated successfully!`, "success");

        // The onSnapshot listener will automatically re-render the static view
        // renderAllQuestions(); // This might cause a quick flicker but ensures immediate update
    } catch (error) {
        console.error("Error saving edited question:", error);
        displayMessage(`Error saving edited question: ${error.message}`, "error");
    }
};

// Function to cancel editing and revert to static display
window.cancelEdit = (questionDivElement) => {
    displayMessage("Edit cancelled.", "info");
    // The onSnapshot listener will automatically revert the display
    // but we can force a re-render for immediate visual feedback.
    renderAllQuestions();
};