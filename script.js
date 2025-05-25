import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, getDocs, onSnapshot, query, orderBy, limit, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Your Firebase configuration (replace with your actual config)
const firebaseConfig = {
    apiKey: "YOUR_API_KEY", // Replace with your actual API Key
    authDomain: "re-dividers-app2.firebaseapp.com",
    projectId: "re-dividers-app2",
    storageBucket: "re-dividers-app2.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID", // Replace with your actual Sender ID
    appId: "YOUR_APP_ID" // Replace with your actual App ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const questionsCollectionRef = collection(db, "artifacts", "homophone-challenge-app-v1", "public", "data", "homophone_questions");
const adminsCollectionRef = collection(db, "artifacts", "homophone-challenge-app-v1", "public", "config", "admins");

let currentUser = null;
let isAdmin = false;
let questions = [];
let timerInterval;
let secondsElapsed = 0;

const questionContainer = document.getElementById("questions-container");
const loginEmailInput = document.getElementById("login-email");
const loginPasswordInput = document.getElementById("login-password");
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const authErrorMessage = document.getElementById("auth-error-message");
const loginFormContainer = document.getElementById("login-form-container");
const logoutFormContainer = document.getElementById("logout-form-container");
const currentUserEmailSpan = document.getElementById("current-user-email");
const addQuestionSection = document.getElementById("add-question-section");
const addQuestionForm = document.getElementById("addQuestionForm");
const newSentence1Input = document.getElementById("newSentence1");
const newAnswer1Input = document.getElementById("newAnswer1");
const newSentence2Input = document.getElementById("newSentence2");
const newAnswer2Input = document.getElementById("newAnswer2");
const messageBox = document.getElementById("messageBox");

const checkAnswersBtnTop = document.getElementById("checkAnswersBtnTop");
const checkAnswersBtnBottom = document.getElementById("checkAnswersBtnBottom");
const resultTop = document.getElementById("topResult");
const resultBottom = document.getElementById("result");
const timerDisplay = document.getElementById("timer");
const userIdDisplay = document.getElementById("userIdDisplay");


// --- Utility Functions ---

function normalize(str) {
    return str.trim().toLowerCase().replace(/[.,!?;:'"-]+/g, "").replace(/\s+/g, " ");
}

function showMessage(msg, type = 'success') {
    messageBox.textContent = msg;
    messageBox.className = `message-box ${type}`;
    messageBox.style.display = 'block';
    setTimeout(() => {
        messageBox.style.display = 'none';
    }, 5000); // Hide after 5 seconds
}

// --- Hardcoded Questions (Your 22 Questions) ---
function getInitialHardcodedQuestions() {
    return [
        {
            sentence1: "When Martha's neighbor played his CD music after midnight, no one could calm her down. She was ____.",
            answer1: "disconsolate",
            sentence2: "She was very upset that he put the ____.",
            answer2: "disc on so late",
        },
        {
            sentence1: "Even a Supreme Court ____ needs an occasional break.",
            answer1: "justice",
            sentence2: "Sotomayor takes her tea without lemon or sugar; she has it with ____.",
            answer2: "just ice",
        },
        {
            sentence1: "My dog couldn't control his bladder in the house and peed on my ____.",
            answer1: "carpet",
            sentence2: "Now he stays in my automobile. He's a ____.",
            answer2: "car pet",
        },
        {
            sentence1: "Jennifer was suspicious of the police officers huddled ____.",
            answer1: "together",
            sentence2: "She was sure they were out ____.",
            answer2: "to get her",
        },
        {
            sentence1: "It took hours, but Tom finally shaved off his beard and ____.",
            answer1: "mustache",
            sentence2: "I really think his arm ____ from all the effort.",
            answer2: "must ache",
        },
        {
            sentence1: "In Paris I visited the National ____.",
            answer1: "archive",
            sentence2: "And then the Triumphal ____. ____ never seen anything so impressive.",
            answer2: ["arch", "ive"], // Example of multiple blanks
        },
        {
            sentence1: "You shouldn't sit around and let your muscles ____.",
            answer1: "atrophy",
            sentence2: "You'd better train for the marathon if you want to win ____.",
            answer2: "a trophy",
        },
        {
            sentence1: "Wearing her crown adorned with oval and ____ sapphires, the listless queen felt undecided.",
            answer1: "orbed",
            sentence2: "Should she go to the banquet ____?",
            answer2: "or bed",
        },
        {
            sentence1: "The clumsy chemist ____ and spilled the slimy serum on the floor.",
            answer1: "goofed",
            sentence2: "Overnight, this ____ a swarm of ants that then gained superpowers.",
            answer2: "goo fed",
        },
        {
            sentence1: "The old deer was exhausted and his legs nearly ____.",
            answer1: "buckled",
            sentence2: "Still, the ____ his herd through the dense forest to safety.",
            answer2: "buck led",
        },
        {
            sentence1: "With acid and a metal plate, she’s an ____ like no other.",
            answer1: "etcher",
            sentence2: "She can do lettering, illustrations, patterns, ____. ____ talents are truly limitless.",
            answer2: ["etc", "her"], // Example of multiple blanks
        },
        {
            sentence1: "My ____ other insists on a prenup before marriage.",
            answer1: "significant",
            sentence2: "I don’t agree, but I’ll ____ change her mind.",
            answer2: "sign if i can't",
        },
        {
            sentence1: "The athlete suffered a direct hit to his left ____ during the game.",
            answer1: "testis",
            sentence2: "A medical ____ required to ensure full recovery.",
            answer2: "test is",
        },
        {
            sentence1: "I stopped watching Game of Thrones. You've seen one ____, you've seen them all.",
            answer1: "dragon",
            sentence2: "After a few episodes the series seemed to ____.",
            answer2: "drag on",
        },
        {
            sentence1: "You say you’re fed up, that I've been ____ to prove my feelings since our freshman year?",
            answer1: "promising",
            sentence2: "You'll see when at the ____ you a love ballad.",
            answer2: "prom i sing",
        },
        {
            sentence1: "The queen can’t stop ____ about how her husband has changed for the better.",
            answer1: "thinking",
            sentence2: "The newly ____ is the picture of health.",
            answer2: "thin king",
        },
        {
            sentence1: "The picnic was going great, with me winning 21-16 at ____.",
            answer1: "badminton",
            sentence2: "But when it came time to eat, with one taste I knew I'd put ____ the lamb.",
            answer2: "bad mint on",
        },
        {
            sentence1: "Our pet Misty deems depressed and appears ____, staring blankly at the wall for hours.",
            answer1: "catatonic",
            sentence2: "We need to give that ____ for her nerves.",
            answer2: "cat a tonic",
        },
        {
            sentence1: "I stayed with my mother's older brother and he was appalled at how ____ I left the room.",
            answer1: "unclean",
            sentence2: "I felt terrible and gave my ____ apology.",
            answer2: "uncle an",
        },
        {
            sentence1: "What you don’t do to help endangered animals may doom them like the ____ bird.",
            answer1: "dodo",
            sentence2: "What you ____ can ensure their survival for years to come.",
            answer2: "do do",
        },
        {
            sentence1: "The stylist took one look at Henry's brittle nails, and asked if he'd like to add keratin treatments to his ____.",
            answer1: "manicure",
            sentence2: "She added, \"I assure you, ____ of this condition says it's well worth the cost!\"",
            answer2: "man i cure",
        },
        {
            sentence1: "Dangerously, the tiny boat began to ____ in the storm.",
            answer1: "capsize",
            sentence2: "Engine problems arose as the wrong ____ on the fuel tank let in seawater.",
            answer2: "cap size",
        },
    ];
}


// --- Render Questions ---

function renderAllQuestions(fetchedQuestions) {
    questionContainer.innerHTML = ''; // Clear existing questions
    questions = fetchedQuestions; // Update global questions array

    questions.forEach((q, index) => {
        const questionDiv = document.createElement("div");
        questionDiv.className = "question";
        questionDiv.setAttribute("data-index", index); // Store original index

        let sentence1Html = `<p><strong>${index + 1}.</strong> ${q.sentence1.replace(/___+/g, `<input type="text" id="answer${(index * 2) + 1}" placeholder="Answer" class="medium">`)}</p>`;
        let sentence2Html = `<p>${q.sentence2.replace(/___+/g, `<input type="text" id="answer${(index * 2) + 2}" placeholder="Answer" class="medium">`)}</p>`;

        // Handle cases with multiple blanks (like question 6 and 11)
        if (Array.isArray(q.answer2)) {
            // Re-evaluating the above. It's safer to have an explicit blank count or more robust replacement
            // For now, let's keep the two blank logic and adjust the HTML directly if needed.
            if (index === 5) { // Question 6 (index 5) has two blanks in sentence2
                sentence2Html = `<p>And then the Triumphal <input type="text" id="answer${(index * 2) + 2}" placeholder="Answer" class="small">.<span class="large-period">.</span> <input type="text" id="answer${(index * 2) + 3}" placeholder="Answer" class="small"> never seen anything so impressive.</p>`;
            } else if (index === 10) { // Question 11 (index 10) has two blanks in sentence2
                sentence2Html = `<p>She can do lettering, illustrations, patterns, <input type="text" id="answer${(index * 2) + 2}" placeholder="Answer" class="small"><span class="large-period">.</span><span style="padding: 0 5px;"></span> <input type="text" id="answer${(index * 2) + 3}" placeholder="Answer" class="small"> talents are truly limitless.</p>`;
            } else { // Fallback for single blank in sentence2 for other questions
                sentence2Html = `<p>${q.sentence2.replace(/___+/g, `<input type="text" id="answer${(index * 2) + 2}" placeholder="Answer" class="medium">`)}</p>`;
            }
        }


        questionDiv.innerHTML = sentence1Html + sentence2Html;
        questionContainer.appendChild(questionDiv);
    });
}

// --- Firebase Data Loading ---

async function loadQuestions() {
    try {
        const q = query(questionsCollectionRef, orderBy("id"), limit(100)); // Limit to a reasonable number
        const querySnapshot = await getDocs(q);

        const fetchedQuestions = [];
        querySnapshot.forEach((doc) => {
            fetchedQuestions.push({ id: doc.id, ...doc.data() });
        });

        if (fetchedQuestions.length === 0) {
            console.log("Firestore collection is empty. Populating with initial hardcoded questions.");
            const initialQuestions = getInitialHardcodedQuestions();
            let currentId = 1;
            for (const q of initialQuestions) {
                // Use a counter for 'id' to ensure order, or Firebase auto-ID
                const newDocRef = doc(questionsCollectionRef, String(currentId++)); // Use string ID
                await setDoc(newDocRef, q)
                    .then(() => console.log(`Added hardcoded question ${newDocRef.id}`))
                    .catch(error => console.error(`Error adding hardcoded question ${newDocRef.id}: `, error));
            }
            // Re-fetch after populating
            const repopulatedSnapshot = await getDocs(q);
            repopulatedSnapshot.forEach((doc) => {
                fetchedQuestions.push({ id: doc.id, ...doc.data() });
            });
            renderAllQuestions(fetchedQuestions);
        } else {
            renderAllQuestions(fetchedQuestions);
        }
    } catch (e) {
        console.error("Error loading questions: ", e);
        // Fallback to hardcoded questions if there's a problem loading from Firestore
        console.warn("Falling back to hardcoded questions due to Firestore error.");
        renderAllQuestions(getInitialHardcodedQuestions());
    }
}

// --- Admin Logic ---

async function checkAdminStatus(uid) {
    if (!uid) {
        isAdmin = false;
        return;
    }
    try {
        const adminDoc = await getDocs(query(adminsCollectionRef));
        const admins = adminDoc.docs.map(doc => doc.id); // Assuming UID is the document ID
        isAdmin = admins.includes(uid);
        console.log("Is Admin:", isAdmin);
        updateAdminUI();
    } catch (e) {
        console.error("Error checking admin status:", e);
        isAdmin = false;
        updateAdminUI();
    }
}

function updateAdminUI() {
    if (isAdmin) {
        addQuestionSection.style.display = 'block';
    } else {
        addQuestionSection.style.display = 'none';
    }
}

async function addNewQuestion() {
    const sentence1 = newSentence1Input.value.trim();
    const answer1 = newAnswer1Input.value.trim();
    const sentence2 = newSentence2Input.value.trim();
    const answer2 = newAnswer2Input.value.trim();

    if (!sentence1 || !answer1 || !sentence2 || !answer2) {
        showMessage("Please fill in all fields.", "error");
        return;
    }

    try {
        const newQuestion = {
            sentence1: sentence1,
            answer1: answer1,
            sentence2: sentence2,
            answer2: answer2,
            createdAt: new Date(), // Optional: Add a timestamp
            createdBy: currentUser ? currentUser.email : 'anonymous' // Optional: Track creator
        };
        // Get current number of questions to assign next ID
        const snapshot = await getDocs(questionsCollectionRef);
        const nextId = snapshot.size > 0 ? Math.max(...snapshot.docs.map(doc => parseInt(doc.id))) + 1 : 1;

        await setDoc(doc(questionsCollectionRef, String(nextId)), newQuestion);
        showMessage("Question added successfully!", "success");
        addQuestionForm.reset(); // Clear the form
        // No need to manually re-render, onSnapshot listener will handle it
    } catch (e) {
        console.error("Error adding document: ", e);
        showMessage("Error adding question. Check console for details.", "error");
    }
}

addQuestionForm.addEventListener('submit', addNewQuestion);

// --- Authentication UI and Logic ---

loginBtn.addEventListener('click', async () => {
    const email = loginEmailInput.value;
    const password = loginPasswordInput.value;
    authErrorMessage.textContent = ''; // Clear previous errors

    try {
        // Try to sign in
        await signInWithEmailAndPassword(auth, email, password);
        console.log("Signed in with email and password.");
    } catch (error) {
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            // If sign-in fails, try to create an account
            try {
                await createUserWithEmailAndPassword(auth, email, password);
                console.log("User created and signed in.");
            } catch (createError) {
                authErrorMessage.textContent = createError.message;
                console.error("Error creating user:", createError);
            }
        } else {
            authErrorMessage.textContent = error.message;
            console.error("Error signing in:", error);
        }
    }
});

logoutBtn.addEventListener('click', async () => {
    try {
        await signOut(auth);
        console.log("User signed out.");
    } catch (error) {
        console.error("Error signing out:", error);
    }
});

// Auth state listener
onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
        console.log("User is logged in:", user.email || "Anonymous");
        // If it's an anonymous user, show the login form to allow them to sign in properly
        if (user.isAnonymous) {
            loginFormContainer.style.display = 'block'; // Show login form
            logoutFormContainer.style.display = 'none'; // Hide logout button
            currentUserEmailSpan.textContent = "Anonymous User"; // Clarify anonymous status
            userIdDisplay.textContent = `User ID: ${user.uid} (Anonymous)`;
            isAdmin = false; // Anonymous users are not admins
            updateAdminUI(); // Hide admin sections
        } else { // This is a named user (email/password)
            loginFormContainer.style.display = 'none'; // Hide login form
            logoutFormContainer.style.display = 'block'; // Show logout button
            currentUserEmailSpan.textContent = user.email;
            userIdDisplay.textContent = `User ID: ${user.uid}`;
            await checkAdminStatus(user.uid); // Check admin status for named users
        }
    } else { // No user session found (logged out or first load without anonymous session)
        console.log("No user session found. Showing login form and attempting anonymous sign-in.");
        loginFormContainer.style.display = 'block'; // Ensure login form is visible
        logoutFormContainer.style.display = 'none'; // Ensure logout button is hidden
        currentUserEmailSpan.textContent = '';
        userIdDisplay.textContent = 'User ID: Not Logged In';
        isAdmin = false;
        updateAdminUI(); // Hide admin sections

        // Attempt anonymous sign-in if no user is found
        try {
            await signInAnonymously(auth);
            console.log("Signed in anonymously.");
            // onAuthStateChanged will trigger again with the anonymous user
        } catch (error) {
            console.error("Error signing in anonymously:", error);
        }
    }
});

// Real-time listener for questions
onSnapshot(questionsCollectionRef, (snapshot) => {
    const updatedQuestions = [];
    snapshot.forEach((doc) => {
        updatedQuestions.push({ id: doc.id, ...doc.data() });
    });
    // Sort questions by ID to maintain consistent order
    updatedQuestions.sort((a, b) => parseInt(a.id) - parseInt(b.id));
    renderAllQuestions(updatedQuestions);
});

// --- Game Logic ---

function updateTimer() {
    secondsElapsed++;
    const minutes = Math.floor(secondsElapsed / 60);
    const seconds = secondsElapsed % 60;
    timerDisplay.textContent = `Elapsed time: ${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Start timer on page load
document.addEventListener('DOMContentLoaded', () => {
    timerInterval = setInterval(updateTimer, 1000);
    timerDisplay.textContent = `Elapsed time: 0:00`; // Initial display
    loadQuestions(); // Load questions when DOM is ready
});

function checkAnswers() {
    let score = 0;
    const finalSeconds = secondsElapsed;
    const finalMinutes = Math.floor(finalSeconds / 60);
    const remainingSeconds = finalSeconds % 60;
    const formattedTime = `${finalMinutes}:${remainingSeconds.toString().padStart(2, '0')}`;

    questions.forEach((q, index) => {
        const input1 = document.getElementById(`answer${(index * 2) + 1}`);
        const input2 = document.getElementById(`answer${(index * 2) + 2}`);
        let isCorrect = true;

        if (input1) {
            const normalizedInput1 = normalize(input1.value);
            const expectedAnswer1 = normalize(q.answer1);
            if (normalizedInput1 === expectedAnswer1) {
                input1.classList.remove('incorrect');
                input1.classList.add('correct');
            } else {
                input1.classList.remove('correct');
                input1.classList.add('incorrect');
                isCorrect = false;
            }
        } else {
             isCorrect = false; // If input field not found, treat as incorrect
        }


        // Handle multiple blanks in sentence2 as seen in questions 6 and 11
        if (Array.isArray(q.answer2)) {
            const input3 = document.getElementById(`answer${(index * 2) + 3}`); // For the third blank (if exists)

            const normalizedInput2 = normalize(input2.value);
            const expectedAnswer2_part1 = normalize(q.answer2[0]);

            if (normalizedInput2 === expectedAnswer2_part1) {
                input2.classList.remove('incorrect');
                input2.classList.add('correct');
            } else {
                input2.classList.remove('correct');
                input2.classList.add('incorrect');
                isCorrect = false;
            }

            if (input3) { // Check if the third input field exists
                const normalizedInput3 = normalize(input3.value);
                const expectedAnswer2_part2 = normalize(q.answer2[1]);
                if (normalizedInput3 === expectedAnswer2_part2) {
                    input3.classList.remove('incorrect');
                    input3.classList.add('correct');
                } else {
                    input3.classList.remove('correct');
                    input3.classList.add('incorrect');
                    isCorrect = false;
                }
            } else {
                // If there's supposed to be a third input but it's not found, treat as incorrect
                if (q.answer2.length > 1) {
                    isCorrect = false;
                }
            }
        } else if (input2) { // Standard single blank in sentence2
            const normalizedInput2 = normalize(input2.value);
            const expectedAnswer2 = normalize(q.answer2);
            if (normalizedInput2 === expectedAnswer2) {
                input2.classList.remove('incorrect');
                input2.classList.add('correct');
            } else {
                input2.classList.remove('correct');
                input2.classList.add('incorrect');
                isCorrect = false;
            }
        } else {
            isCorrect = false; // If input field not found, treat as incorrect
        }


        if (isCorrect) {
            score++;
        }
    });

    const totalQuestions = questions.length;
    const percentage = (score / totalQuestions) * 100;

    resultTop.textContent = `Score: ${score}/${totalQuestions} (${percentage.toFixed(0)}%) - Time: ${formattedTime}`;
    resultBottom.textContent = `Score: ${score}/${totalQuestions} (${percentage.toFixed(0)}%) - Time: ${formattedTime}`;
}

// Attach checkAnswers to both buttons
checkAnswersBtnTop.addEventListener('click', checkAnswers);
checkAnswersBtnBottom.addEventListener('click', checkAnswers);