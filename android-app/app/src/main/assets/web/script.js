function formatDate(date) {
    try {
        if (!date) return '';
        if (!(date instanceof Date)) return date;
        if (isNaN(date.getTime())) return ''; // Check for invalid date
        
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        return date.toLocaleDateString('en-GB', options);
    } catch (error) {
        console.error('Error formatting date:', error, 'Date value:', date);
        return '';
    }
}

// Default settings
const DEFAULT_SETTINGS = {
    cranialUltrasound: {
        gestation: 30,
        weight: 1.5,
        followUpGestation: 29,
        followUpWeight: 1.0,
        initialDay: 3,
        followUpDay: 28
    },
    medications: {
        hydrocortisoneGestation: 28,
        hydrocortisoneReviewDay: 10,
        probioticsGestation: 32,
        probioticsWeight: 1.5,
        caffeineGestation: 32,
        caffeineReviewGestation: 34,
        sytronWeight: 2.5,
        sytronStartDay: 28
    },
    feeding: {
        pnGestation: 30,
        pnWeight: 1.25,
        pnReviewDay: 5,
        trophicGestation: 27,
        trophicWeight: 0.8,
        breastMilkIncrementGestation: 29,
        breastMilkIncrementWeight: 1.5,
        fortifierGestation: 32,
        formulaAvoidGestation: 30,
        formulaAvoidWeight: 1.0,
        fullEnteralGestation: 32,
        fullEnteralWeight: 1.5,
        breastMilkAdvancement: {
            standardIncrement: 30,
            slowIncrement: 15
        },
        formulaAdvancement: {
            standardIncrement: 20,
            slowIncrement: 10
        }
    }
};

// Initialize IndexedDB
const dbName = 'milestonesDB';
const dbVersion = 1;
let db;

const initDB = () => {
    return new Promise((resolve, reject) => {
        console.log('Starting database initialization...');
        if (db) {
            console.log('Database already initialized');
            resolve(db);
            return;
        }

        // Update database version to handle the new structure
        const request = indexedDB.open(dbName, 2);

        request.onerror = (event) => {
            console.error('IndexedDB error:', event.target.error);
            console.error('IndexedDB error details:', {
                name: event.target.error.name,
                message: event.target.error.message
            });
            reject(event.target.error);
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            console.log('IndexedDB initialized successfully');
            console.log('Database name:', db.name);
            console.log('Database version:', db.version);
            console.log('Object stores:', Array.from(db.objectStoreNames));
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            console.log('Database upgrade needed');
            const db = event.target.result;
            
            try {
                // Create stores if they don't exist
                if (!db.objectStoreNames.contains('calculations')) {
                    console.log('Creating calculations store');
                    db.createObjectStore('calculations', { keyPath: 'id', autoIncrement: true });
                }
                
                // Update settings store for multiple profiles - delete old store if upgrading from v1
                if (event.oldVersion < 2 && db.objectStoreNames.contains('settings')) {
                    console.log('Upgrading settings store for profiles');
                    // Get the existing settings first if available
                    let existingSettings = null;
                    
                    try {
                        // Try to get the existing settings before deleting the store
                        const transaction = event.target.transaction;
                        const store = transaction.objectStore('settings');
                        const getRequest = store.get('userSettings');
                        
                        getRequest.onsuccess = function() {
                            if (getRequest.result) {
                                existingSettings = getRequest.result;
                            }
                        };
                    } catch (e) {
                        console.log('No existing settings to migrate', e);
                    }
                    
                    // Delete old store
                    db.deleteObjectStore('settings');
                    
                    // Create new profiles store
                    const profilesStore = db.createObjectStore('settingsProfiles', { keyPath: 'id', autoIncrement: true });
                    profilesStore.createIndex('name', 'name', { unique: true });

                    // Add default profile
                    const defaultProfile = {
                        name: 'Default',
                        isActive: true,
                        settings: existingSettings ? existingSettings : {
                            cranialUltrasound: DEFAULT_SETTINGS.cranialUltrasound,
                            medications: DEFAULT_SETTINGS.medications,
                            feeding: DEFAULT_SETTINGS.feeding
                        },
                        createdAt: new Date().toISOString()
                    };
                    
                    profilesStore.add(defaultProfile);
                    console.log('Created default profile');
                } else if (!db.objectStoreNames.contains('settingsProfiles')) {
                    // Create the new profiles store if it doesn't exist
                    const profilesStore = db.createObjectStore('settingsProfiles', { keyPath: 'id', autoIncrement: true });
                    profilesStore.createIndex('name', 'name', { unique: true });

                    // Add default profile
                    const defaultProfile = {
                        name: 'Default',
                        isActive: true,
                        settings: {
                            cranialUltrasound: DEFAULT_SETTINGS.cranialUltrasound,
                            medications: DEFAULT_SETTINGS.medications,
                            feeding: DEFAULT_SETTINGS.feeding
                        },
                        createdAt: new Date().toISOString()
                    };
                    
                    profilesStore.add(defaultProfile);
                    console.log('Created default profile');
                }
                
                console.log('Database upgrade completed successfully');
            } catch (error) {
                console.error('Error during database upgrade:', error);
                throw error;
            }
        };
    });
};

// Ensure database is ready
async function ensureDatabase() {
    if (!db) {
        console.log('Database not initialized, initializing now...');
        try {
            await initDB();
            console.log('Database initialized successfully');
            // Initialize with default settings if needed
            const transaction = db.transaction(['settings'], 'readonly');
            const store = transaction.objectStore('settings');
            const settings = await store.get('userSettings');
            if (!settings) {
                console.log('No settings found, adding defaults...');
                const defaultSettings = {
                    id: 'userSettings',
                    cranialUltrasound: DEFAULT_SETTINGS.cranialUltrasound,
                    medications: DEFAULT_SETTINGS.medications,
                    feeding: DEFAULT_SETTINGS.feeding
                };
                const writeTransaction = db.transaction(['settings'], 'readwrite');
                const writeStore = writeTransaction.objectStore('settings');
                await writeStore.add(defaultSettings);
                console.log('Default settings added successfully');
            }
        } catch (error) {
            console.error('Failed to initialize database:', error);
            throw new Error('Database initialization failed: ' + error.message);
        }
    }
    return db;
}

// Save calculation results to IndexedDB
const saveCalculation = (data) => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['calculations'], 'readwrite');
        const store = transaction.objectStore('calculations');
        const calculationData = {
            ...data,
            timestamp: new Date().toISOString(),
            needsSync: !navigator.onLine // Mark for sync if offline
        };
        
        const request = store.add(calculationData);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

// Get previous calculations from IndexedDB
const getCalculations = () => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['calculations'], 'readonly');
        const store = transaction.objectStore('calculations');
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

// Save milestone settings to localStorage
async function saveMilestoneSettings() {
    const settings = {
        id: 'userSettings',
        cranialUltrasound: {
            gestation: parseFloat(document.getElementById('cranialUltrasoundGestation').value) || 28,
            weight: parseFloat(document.getElementById('cranialUltrasoundWeight').value) || 1.5,
            followUpGestation: parseFloat(document.getElementById('cranialUltrasoundFollowUpGestation').value) || 29,
            followUpWeight: parseFloat(document.getElementById('cranialUltrasoundFollowUpWeight').value) || 1.0,
            initialDay: parseInt(document.getElementById('cranialUltrasoundInitialDay').value) || 3,
            followUpDay: parseInt(document.getElementById('cranialUltrasoundFollowUpDay').value) || 28
        },
        medications: {
            hydrocortisoneGestation: parseFloat(document.getElementById('hydrocortisoneGestation').value) || DEFAULT_SETTINGS.medications.hydrocortisoneGestation,
            hydrocortisoneReviewDay: parseInt(document.getElementById('hydrocortisoneReviewDay').value) || DEFAULT_SETTINGS.medications.hydrocortisoneReviewDay,
            probioticsGestation: parseFloat(document.getElementById('probioticsGestation').value) || DEFAULT_SETTINGS.medications.probioticsGestation,
            probioticsWeight: parseFloat(document.getElementById('probioticsWeight').value) || DEFAULT_SETTINGS.medications.probioticsWeight,
            caffeineGestation: parseFloat(document.getElementById('caffeineGestation').value) || DEFAULT_SETTINGS.medications.caffeineGestation,
            caffeineReviewGestation: parseFloat(document.getElementById('caffeineReviewGestation').value) || DEFAULT_SETTINGS.medications.caffeineReviewGestation,
            sytronWeight: parseFloat(document.getElementById('sytronWeight').value) || DEFAULT_SETTINGS.medications.sytronWeight,
            sytronStartDay: parseInt(document.getElementById('sytronStartDay').value) || DEFAULT_SETTINGS.medications.sytronStartDay
        },
        feeding: {
            pnGestation: parseFloat(document.getElementById('pnGestation').value) || DEFAULT_SETTINGS.feeding.pnGestation,
            pnWeight: parseFloat(document.getElementById('pnWeight').value) || DEFAULT_SETTINGS.feeding.pnWeight,
            trophicGestation: parseFloat(document.getElementById('trophicGestation').value) || DEFAULT_SETTINGS.feeding.trophicGestation,
            trophicWeight: parseFloat(document.getElementById('trophicWeight').value) || DEFAULT_SETTINGS.feeding.trophicWeight,
            breastMilkIncrementGestation: parseFloat(document.getElementById('breastMilkIncrementGestation').value) || DEFAULT_SETTINGS.feeding.breastMilkIncrementGestation,
            breastMilkIncrementWeight: parseFloat(document.getElementById('breastMilkIncrementWeight').value) || DEFAULT_SETTINGS.feeding.breastMilkIncrementWeight,
            fortifierGestation: parseFloat(document.getElementById('fortifierGestation').value) || DEFAULT_SETTINGS.feeding.fortifierGestation,
            formulaAvoidGestation: parseFloat(document.getElementById('formulaAvoidGestation').value) || DEFAULT_SETTINGS.feeding.formulaAvoidGestation,
            formulaAvoidWeight: parseFloat(document.getElementById('formulaAvoidWeight').value) || DEFAULT_SETTINGS.feeding.formulaAvoidWeight,
            fullEnteralGestation: parseFloat(document.getElementById('fullEnteralGestation').value) || DEFAULT_SETTINGS.feeding.fullEnteralGestation,
            fullEnteralWeight: parseFloat(document.getElementById('fullEnteralWeight').value) || DEFAULT_SETTINGS.feeding.fullEnteralWeight,
            breastMilkAdvancement: {
                standardIncrement: parseFloat(document.getElementById('breastMilkStandardIncrement').value) || DEFAULT_SETTINGS.feeding.breastMilkAdvancement.standardIncrement,
                slowIncrement: parseFloat(document.getElementById('breastMilkSlowIncrement').value) || DEFAULT_SETTINGS.feeding.breastMilkAdvancement.slowIncrement
            },
            formulaAdvancement: {
                standardIncrement: parseFloat(document.getElementById('formulaStandardIncrement').value) || DEFAULT_SETTINGS.feeding.formulaAdvancement.standardIncrement,
                slowIncrement: parseFloat(document.getElementById('formulaSlowIncrement').value) || DEFAULT_SETTINGS.feeding.formulaAdvancement.slowIncrement
            }
        }
    };

    try {
        const transaction = db.transaction(['settings'], 'readwrite');
        const store = transaction.objectStore('settings');
        await store.put(settings);
        alert('Settings saved successfully');
    } catch (error) {
        console.error('Error saving settings:', error);
        alert('Failed to save settings. Please try again.');
    }
}

// Load milestone settings from IndexedDB
async function loadMilestoneSettings() {
    try {
        const transaction = db.transaction(['settings'], 'readonly');
        const store = transaction.objectStore('settings');
        const settings = await store.get('userSettings');

        if (settings) {
            // Load values into form
            document.getElementById('cranialUltrasoundGestation').value = settings.cranialUltrasound.gestation;
            document.getElementById('cranialUltrasoundWeight').value = settings.cranialUltrasound.weight;
            document.getElementById('cranialUltrasoundInitialDay').value = settings.cranialUltrasound.initialDay;
            document.getElementById('cranialUltrasoundFollowUpDay').value = settings.cranialUltrasound.followUpDay;
            document.getElementById('cranialUltrasoundFollowUpGestation').value = settings.cranialUltrasound.followUpGestation;
            document.getElementById('cranialUltrasoundFollowUpWeight').value = settings.cranialUltrasound.followUpWeight;
            
            // Medication settings
            document.getElementById('hydrocortisoneGestation').value = settings.medications.hydrocortisoneGestation;
            document.getElementById('hydrocortisoneReviewDay').value = settings.medications.hydrocortisoneReviewDay;
            document.getElementById('probioticsGestation').value = settings.medications.probioticsGestation;
            document.getElementById('probioticsWeight').value = settings.medications.probioticsWeight;
            document.getElementById('caffeineGestation').value = settings.medications.caffeineGestation;
            document.getElementById('caffeineReviewGestation').value = settings.medications.caffeineReviewGestation;
            document.getElementById('sytronWeight').value = settings.medications.sytronWeight;
            document.getElementById('sytronStartDay').value = settings.medications.sytronStartDay;
            
            // Feeding settings
            document.getElementById('pnGestation').value = settings.feeding.pnGestation;
            document.getElementById('pnWeight').value = settings.feeding.pnWeight;
            document.getElementById('trophicGestation').value = settings.feeding.trophicGestation;
            document.getElementById('trophicWeight').value = settings.feeding.trophicWeight;
            document.getElementById('breastMilkIncrementGestation').value = settings.feeding.breastMilkIncrementGestation;
            document.getElementById('breastMilkIncrementWeight').value = settings.feeding.breastMilkIncrementWeight;
            document.getElementById('fortifierGestation').value = settings.feeding.fortifierGestation;
            document.getElementById('formulaAvoidGestation').value = settings.feeding.formulaAvoidGestation;
            document.getElementById('formulaAvoidWeight').value = settings.feeding.formulaAvoidWeight;
            document.getElementById('fullEnteralGestation').value = settings.feeding.fullEnteralGestation;
            document.getElementById('fullEnteralWeight').value = settings.feeding.fullEnteralWeight;
            document.getElementById('breastMilkStandardIncrement').value = settings.feeding.breastMilkAdvancement.standardIncrement;
            document.getElementById('breastMilkSlowIncrement').value = settings.feeding.breastMilkAdvancement.slowIncrement;
            document.getElementById('formulaStandardIncrement').value = settings.feeding.formulaAdvancement.standardIncrement;
            document.getElementById('formulaSlowIncrement').value = settings.feeding.formulaAdvancement.slowIncrement;
        } else {
            // Silently initialize with defaults without showing confirmation
            const transaction = db.transaction(['settings'], 'readwrite');
            const store = transaction.objectStore('settings');
            
            const defaultSettings = {
                id: 'userSettings',
                cranialUltrasound: DEFAULT_SETTINGS.cranialUltrasound,
                medications: DEFAULT_SETTINGS.medications,
                feeding: DEFAULT_SETTINGS.feeding
            };
            await store.add(defaultSettings);
            
            // Load the default values into the form
            document.getElementById('cranialUltrasoundGestation').value = defaultSettings.cranialUltrasound.gestation;
            document.getElementById('cranialUltrasoundWeight').value = defaultSettings.cranialUltrasound.weight;
            document.getElementById('cranialUltrasoundInitialDay').value = defaultSettings.cranialUltrasound.initialDay;
            document.getElementById('cranialUltrasoundFollowUpDay').value = defaultSettings.cranialUltrasound.followUpDay;
            document.getElementById('cranialUltrasoundFollowUpGestation').value = defaultSettings.cranialUltrasound.followUpGestation;
            document.getElementById('cranialUltrasoundFollowUpWeight').value = defaultSettings.cranialUltrasound.followUpWeight;
            
            document.getElementById('hydrocortisoneGestation').value = defaultSettings.medications.hydrocortisoneGestation;
            document.getElementById('hydrocortisoneReviewDay').value = defaultSettings.medications.hydrocortisoneReviewDay;
            document.getElementById('probioticsGestation').value = defaultSettings.medications.probioticsGestation;
            document.getElementById('probioticsWeight').value = defaultSettings.medications.probioticsWeight;
            document.getElementById('caffeineGestation').value = defaultSettings.medications.caffeineGestation;
            document.getElementById('caffeineReviewGestation').value = defaultSettings.medications.caffeineReviewGestation;
            document.getElementById('sytronWeight').value = defaultSettings.medications.sytronWeight;
            document.getElementById('sytronStartDay').value = defaultSettings.medications.sytronStartDay;
            
            document.getElementById('pnGestation').value = defaultSettings.feeding.pnGestation;
            document.getElementById('pnWeight').value = defaultSettings.feeding.pnWeight;
            document.getElementById('trophicGestation').value = defaultSettings.feeding.trophicGestation;
            document.getElementById('trophicWeight').value = defaultSettings.feeding.trophicWeight;
            document.getElementById('breastMilkIncrementGestation').value = defaultSettings.feeding.breastMilkIncrementGestation;
            document.getElementById('breastMilkIncrementWeight').value = defaultSettings.feeding.breastMilkIncrementWeight;
            document.getElementById('fortifierGestation').value = defaultSettings.feeding.fortifierGestation;
            document.getElementById('formulaAvoidGestation').value = defaultSettings.feeding.formulaAvoidGestation;
            document.getElementById('formulaAvoidWeight').value = defaultSettings.feeding.formulaAvoidWeight;
            document.getElementById('fullEnteralGestation').value = defaultSettings.feeding.fullEnteralGestation;
            document.getElementById('fullEnteralWeight').value = defaultSettings.feeding.fullEnteralWeight;
            document.getElementById('breastMilkStandardIncrement').value = defaultSettings.feeding.breastMilkAdvancement.standardIncrement;
            document.getElementById('breastMilkSlowIncrement').value = defaultSettings.feeding.breastMilkAdvancement.slowIncrement;
            document.getElementById('formulaStandardIncrement').value = defaultSettings.feeding.formulaAdvancement.standardIncrement;
            document.getElementById('formulaSlowIncrement').value = defaultSettings.feeding.formulaAdvancement.slowIncrement;
        }
    } catch (error) {
        console.error('Error loading settings:', error);
        // Silently use defaults without showing confirmation
        const defaultSettings = {
            id: 'userSettings',
            cranialUltrasound: DEFAULT_SETTINGS.cranialUltrasound,
            medications: DEFAULT_SETTINGS.medications,
            feeding: DEFAULT_SETTINGS.feeding
        };
        
        // Load the default values into the form without saving to DB (since there was an error)
        document.getElementById('cranialUltrasoundGestation').value = defaultSettings.cranialUltrasound.gestation;
        document.getElementById('cranialUltrasoundWeight').value = defaultSettings.cranialUltrasound.weight;
        document.getElementById('cranialUltrasoundInitialDay').value = defaultSettings.cranialUltrasound.initialDay;
        document.getElementById('cranialUltrasoundFollowUpDay').value = defaultSettings.cranialUltrasound.followUpDay;
        document.getElementById('cranialUltrasoundFollowUpGestation').value = defaultSettings.cranialUltrasound.followUpGestation;
        document.getElementById('cranialUltrasoundFollowUpWeight').value = defaultSettings.cranialUltrasound.followUpWeight;
        
        document.getElementById('hydrocortisoneGestation').value = defaultSettings.medications.hydrocortisoneGestation;
        document.getElementById('hydrocortisoneReviewDay').value = defaultSettings.medications.hydrocortisoneReviewDay;
        document.getElementById('probioticsGestation').value = defaultSettings.medications.probioticsGestation;
        document.getElementById('probioticsWeight').value = defaultSettings.medications.probioticsWeight;
        document.getElementById('caffeineGestation').value = defaultSettings.medications.caffeineGestation;
        document.getElementById('caffeineReviewGestation').value = defaultSettings.medications.caffeineReviewGestation;
        document.getElementById('sytronWeight').value = defaultSettings.medications.sytronWeight;
        document.getElementById('sytronStartDay').value = defaultSettings.medications.sytronStartDay;
        
        document.getElementById('pnGestation').value = defaultSettings.feeding.pnGestation;
        document.getElementById('pnWeight').value = defaultSettings.feeding.pnWeight;
        document.getElementById('trophicGestation').value = defaultSettings.feeding.trophicGestation;
        document.getElementById('trophicWeight').value = defaultSettings.feeding.trophicWeight;
        document.getElementById('breastMilkIncrementGestation').value = defaultSettings.feeding.breastMilkIncrementGestation;
        document.getElementById('breastMilkIncrementWeight').value = defaultSettings.feeding.breastMilkIncrementWeight;
        document.getElementById('fortifierGestation').value = defaultSettings.feeding.fortifierGestation;
        document.getElementById('breastMilkStandardIncrement').value = defaultSettings.feeding.breastMilkAdvancement.standardIncrement;
        document.getElementById('breastMilkSlowIncrement').value = defaultSettings.feeding.breastMilkAdvancement.slowIncrement;
        document.getElementById('formulaStandardIncrement').value = defaultSettings.feeding.formulaAdvancement.standardIncrement;
        document.getElementById('formulaSlowIncrement').value = defaultSettings.feeding.formulaAdvancement.slowIncrement;
    }
}

// Reset settings to defaults
async function resetDefaultSettings() {
    if (window.confirm('Are you sure you want to reset all settings to their default values? This cannot be undone.')) {
        try {
            const transaction = db.transaction(['settings'], 'readwrite');
            const store = transaction.objectStore('settings');
            await store.delete('userSettings');
            
            // Add default settings
            const defaultSettings = {
                id: 'userSettings',
                cranialUltrasound: DEFAULT_SETTINGS.cranialUltrasound,
                medications: DEFAULT_SETTINGS.medications,
                feeding: DEFAULT_SETTINGS.feeding
            };
            await store.add(defaultSettings);
            
            // Reload settings in the form
            await loadMilestoneSettings();
        } catch (error) {
            console.error('Error resetting settings:', error);
        }
    }
}

// Load settings when the settings page is shown
async function showSettingsPage() {
    document.getElementById('mainContent').style.display = 'none';
    document.getElementById('settingsPage').style.display = 'block';
    
    try {
        // Get and load the active profile settings
        const activeProfile = await getActiveSettingsProfile();
        if (activeProfile) {
            loadProfileIntoForm(activeProfile);
        }
        
        // Load profiles into the selector
        await loadProfileSelector();
    } catch (error) {
        console.error('Error loading settings page:', error);
        // Fallback to default settings if there's an error
        loadMilestoneSettings();
    }
}

// Show main content function
function showMainContent() {
    document.getElementById('settingsPage').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';
}

// Get current settings from IndexedDB
async function getCurrentSettings() {
    try {
        // Get the active profile
        const activeProfile = await getActiveSettingsProfile();
        
        if (activeProfile && activeProfile.settings) {
            // Start with default settings
            const settings = { ...DEFAULT_SETTINGS };
            
            // Merge with stored settings
            settings.cranialUltrasound = { 
                ...settings.cranialUltrasound,
                ...activeProfile.settings.cranialUltrasound 
            };
            settings.medications = { 
                ...settings.medications,
                ...activeProfile.settings.medications 
            };
            
            // Handle feeding settings with nested objects
            settings.feeding = {
                ...settings.feeding,
                ...activeProfile.settings.feeding
            };
            
            // Ensure nested objects exist - important for database migration
            if (!settings.feeding.breastMilkAdvancement) {
                settings.feeding.breastMilkAdvancement = DEFAULT_SETTINGS.feeding.breastMilkAdvancement;
            }
            if (!settings.feeding.formulaAdvancement) {
                settings.feeding.formulaAdvancement = DEFAULT_SETTINGS.feeding.formulaAdvancement;
            }
            
            console.log('Retrieved settings from active profile:', settings);
            return settings;
        } else {
            console.log('No active profile found, using defaults');
            return DEFAULT_SETTINGS;
        }
    } catch (error) {
        console.error('Error in getCurrentSettings:', error);
        return DEFAULT_SETTINGS;
    }
}

// Validate user input at the start
function validateUserInput() {
    const gestationWeeks = parseInt(document.getElementById('gestationWeeks').value, 10);
    const gestationDays = parseInt(document.getElementById('gestationDays').value, 10);
    const weight = parseFloat(document.getElementById('weight').value);

    let errorMessage = '';
  
    if (isNaN(weight) || weight < 0.3 || weight > 6) {
        errorMessage += 'Birth Weight must be between 0.3 and 6 kg.\n';
    }

    if (isNaN(gestationWeeks) || gestationWeeks < 20 || gestationWeeks > 45) {
        errorMessage += 'Gestation (Weeks) must be between 20 and 45.\n';
    }

    if (isNaN(gestationDays) || gestationDays < 0 || gestationDays > 7) {
        errorMessage += 'Gestation (Days) must be between 0 and 7.\n';
    }

    if (errorMessage) {
        alert(errorMessage);
        return false;
    }

    return true;
}

// Call validateUserInput before calculating milestones
async function calculateMilestones() {
    try {
        console.log('Starting milestone calculation...');

        if (!validateUserInput()) {
            console.log('Input validation failed');
            return;
        }
        console.log('Input validation passed');

        // Ensure database is ready
        await ensureDatabase();

        // Get current settings first
        console.log('Fetching current settings...');
        const settings = await getCurrentSettings();
        console.log('Settings retrieved:', settings);

        // Get form values
        const patientName = document.getElementById('patientName').value;
        const nhsNumber = document.getElementById('nhsNumber').value;
        const dob = new Date(document.getElementById('dob').value);
        const weight = parseFloat(document.getElementById('weight').value);
        const gestationWeeks = parseInt(document.getElementById('gestationWeeks').value, 10);
        const gestationDays = parseInt(document.getElementById('gestationDays').value, 10);

        console.log('Form values:', {
            patientName,
            nhsNumber,
            dob,
            weight,
            gestationWeeks,
            gestationDays
        });

        if (!dob || isNaN(weight) || isNaN(gestationWeeks) || isNaN(gestationDays)) {
            console.log('Required fields missing or invalid');
            alert('Please fill in all the fields.');
            return;
        }

        // Clear any previous output
        const outputDiv = document.getElementById('output');
        outputDiv.innerHTML = '';

        // Initialize arrays
        console.log('Initializing milestone arrays...');
        const correctedGestations = [];
        const newbornExaminations = [];
        const bloodspotTests = [];
        const cranialUltrasounds = [];
        const medications = [];
        const feedingGuidelines = [];
        const immunisations = [];
        const ropScreening = [];
        const miscellaneousDates = [];
        const researchStudies = [];

        // Calculate corrected gestational milestones
        console.log('Calculating corrected gestations...');
        const gestationMilestones = [30, 32, 34, 36, 38, 40];
        gestationMilestones.forEach(weeks => {
            if (weeks > gestationWeeks) {
                const daysToAdd = (weeks - gestationWeeks) * 7 - gestationDays;
                const milestoneDate = new Date(dob);
                milestoneDate.setDate(milestoneDate.getDate() + daysToAdd);
                correctedGestations.push({ milestone: `${weeks} weeks`, date: milestoneDate });
            }
        });
        console.log('Corrected gestations:', correctedGestations);

        // Newborn examination date
        const day3 = new Date(dob);
        day3.setDate(day3.getDate() + 3);
        newbornExaminations.push({ milestone: 'Newborn examination (by day 3)', date: day3 });

        if (gestationWeeks < 34) {
            const corrected34Weeks = new Date(dob);
            corrected34Weeks.setDate(corrected34Weeks.getDate() + (34 - gestationWeeks) * 7 - gestationDays);
            newbornExaminations.push({ milestone: 'Newborn examination (34 weeks corrected)', date: corrected34Weeks });
        }

        // Newborn bloodspot testing
        const day5 = new Date(dob);
        day5.setDate(day5.getDate() + 5);
        bloodspotTests.push({ milestone: 'Newborn blood spot test (day 5)', date: day5 });
        if (gestationWeeks < 32) {
            const day28 = new Date(dob);
            day28.setDate(day28.getDate() + 28);
            bloodspotTests.push({ milestone: 'Newborn blood spot test (day 28)', date: day28 });
        }

        // Cranial ultrasound tests using custom thresholds
        if (gestationWeeks < settings.cranialUltrasound.gestation || weight < settings.cranialUltrasound.weight) {
            const initialScanDay = new Date(dob);
            initialScanDay.setDate(initialScanDay.getDate() + settings.cranialUltrasound.initialDay);
            cranialUltrasounds.push({ milestone: `Cranial ultrasound (day ${settings.cranialUltrasound.initialDay})`, date: initialScanDay });

            cranialUltrasounds.push({ milestone: 'Cranial ultrasound (before discharge)', date: 'Before Discharge' });

            if (gestationWeeks < settings.cranialUltrasound.followUpGestation || weight < settings.cranialUltrasound.followUpWeight) {
                const followUpScanDay = new Date(dob);
                followUpScanDay.setDate(followUpScanDay.getDate() + settings.cranialUltrasound.followUpDay);
                cranialUltrasounds.push({ milestone: `Cranial ultrasound (day ${settings.cranialUltrasound.followUpDay})`, date: followUpScanDay });
            }
        }

        // Medications using custom thresholds
        if (gestationWeeks < settings.medications.hydrocortisoneGestation) {
            const hydrocortisoneReview = new Date(dob);
            hydrocortisoneReview.setDate(hydrocortisoneReview.getDate() + settings.medications.hydrocortisoneReviewDay);
            medications.push({ milestone: `Hydrocortisone review (day ${settings.medications.hydrocortisoneReviewDay})`, date: hydrocortisoneReview });
        }

        if (gestationWeeks < settings.medications.probioticsGestation || weight < settings.medications.probioticsWeight) {
            const correctedReviewWeeks = new Date(dob);
            correctedReviewWeeks.setDate(correctedReviewWeeks.getDate() + (settings.medications.caffeineReviewGestation - gestationWeeks) * 7 - gestationDays);
            medications.push({ milestone: 'Probiotics start', date: 'Commence when tolerating at least 0.5ml of milk every 2 hours' });
            medications.push({ milestone: `Probiotics review (${settings.medications.caffeineReviewGestation} weeks corrected)`, date: correctedReviewWeeks });
        }

        if (gestationWeeks < settings.medications.caffeineGestation) {
            const correctedCaffeineReview = new Date(dob);
            correctedCaffeineReview.setDate(correctedCaffeineReview.getDate() + (settings.medications.caffeineReviewGestation - gestationWeeks) * 7 - gestationDays);
            medications.push({ milestone: `Caffeine review (${settings.medications.caffeineReviewGestation} weeks corrected)`, date: correctedCaffeineReview });
        } else {
            medications.push({ milestone: 'Caffeine', date: 'Not routinely indicated' });
        }

        if (weight < settings.medications.sytronWeight) {
            const sytronStart = new Date(dob);
            sytronStart.setDate(sytronStart.getDate() + settings.medications.sytronStartDay);
            medications.push({ milestone: `Sytron start (day ${settings.medications.sytronStartDay})`, date: sytronStart, note: 'Do not use if receiving formula or fortifier' });
            medications.push({ milestone: 'Abidec', date: 'Commence when tolerating full feeds. Do not use if receiving formula' });
        }

        // Feeding Guidelines using custom thresholds
        if (gestationWeeks < settings.feeding.pnGestation || weight < settings.feeding.pnWeight) {
            feedingGuidelines.push({ milestone: 'Parenteral Nutrition', date: 'Start within 6 hours of birth' });
        } else {
            feedingGuidelines.push({ milestone: 'Parenteral Nutrition', date: 'Consider if not reaching 100 ml/kg/day by Day 5' });
        }

        // Initial Feeding Rate - Breast Milk using custom thresholds
        if (gestationWeeks < settings.feeding.trophicGestation || weight < settings.feeding.trophicWeight) {
            feedingGuidelines.push({ milestone: 'Breast Milk - Initial Feeding Rate', date: 'Trophic Expressed Breast Milk (EBM)' });
        } else if (gestationWeeks < 30 || weight < 1) {
            feedingGuidelines.push({ milestone: 'Breast Milk - Initial Feeding Rate', date: '15 ml/kg/day' });
        } else if (gestationWeeks >= settings.feeding.fullEnteralGestation && weight >= settings.feeding.fullEnteralWeight) {
            feedingGuidelines.push({ milestone: 'Breast Milk - Initial Feeding Rate', date: 'Full enteral feeds' });
        } else {
            feedingGuidelines.push({ milestone: 'Breast Milk - Initial Feeding Rate', date: '30 ml/kg/day' });
        }

        // Breast Milk Increment Rate
        if (gestationWeeks < settings.feeding.trophicGestation || weight < settings.feeding.trophicWeight) {
            feedingGuidelines.push({ milestone: 'Breast Milk - Increment Rate', date: 'Consider Trophic EBM' });
        } else if (gestationWeeks > settings.feeding.breastMilkIncrementGestation && weight > settings.feeding.breastMilkIncrementWeight) {
            // Standard increment recommended
            feedingGuidelines.push({ 
                milestone: 'Breast Milk - Increment Rate', 
                date: `${settings.feeding.breastMilkAdvancement.standardIncrement} ml/kg/24h` 
            });
        } else {
            // Slow increment recommended
            feedingGuidelines.push({ 
                milestone: 'Breast Milk - Increment Rate', 
                date: `${settings.feeding.breastMilkAdvancement.slowIncrement} ml/kg/24h` 
            });
        }

        // Formula Feeding Guidelines
        if (gestationWeeks < settings.feeding.formulaAvoidGestation || weight < settings.feeding.formulaAvoidWeight) {
            feedingGuidelines.push({ milestone: 'Formula Feeding', date: 'Avoid formula use at this gestation/weight' });
        } else if (gestationWeeks >= settings.feeding.fullEnteralGestation && weight >= settings.feeding.fullEnteralWeight) {
            feedingGuidelines.push({ milestone: 'Formula - Initial Feeding Rate', date: 'Full enteral feeds' });
        } else {
            if (weight < 1.25 || gestationWeeks < 32) {
                // Higher risk infant - recommend slow increment
                feedingGuidelines.push({ 
                    milestone: 'Formula - Initial Feeding Rate', 
                    date: '15 ml/kg/day starting day 3' 
                });
                feedingGuidelines.push({ 
                    milestone: 'Formula - Increment Rate', 
                    date: `${settings.feeding.formulaAdvancement.slowIncrement} ml/kg/24h` 
                });
            } else if (weight <= 1.5) {
                // Standard increment recommended
                feedingGuidelines.push({ 
                    milestone: 'Formula - Initial Feeding Rate', 
                    date: '30 ml/kg/day starting day 1' 
                });
                feedingGuidelines.push({ 
                    milestone: 'Formula - Increment Rate', 
                    date: `${settings.feeding.formulaAdvancement.standardIncrement} ml/kg/24h` 
                });
            } else {
                feedingGuidelines.push({ 
                    milestone: 'Formula Feeding', 
                    date: 'Increase as tolerated' 
                });
            }
        }

        // Immunisations
        const eightWeeks = new Date(dob);
        eightWeeks.setDate(eightWeeks.getDate() + 8 * 7);
        immunisations.push({ milestone: '8-week immunisations', date: eightWeeks });

        const twelveWeeks = new Date(dob);
        twelveWeeks.setDate(twelveWeeks.getDate() + 12 * 7);
        immunisations.push({ milestone: '12-week immunisations', date: twelveWeeks });

        const sixteenWeeks = new Date(dob);
        sixteenWeeks.setDate(sixteenWeeks.getDate() + 16 * 7);
        immunisations.push({ milestone: '16-week immunisations', date: sixteenWeeks });

        const twelveMonths = new Date(dob);
        twelveMonths.setMonth(twelveMonths.getMonth() + 12);
        immunisations.push({ milestone: '12-month immunisations', date: twelveMonths });

        // ROP Screening Calculations
        let screeningStart;
        if (gestationWeeks < 27) {
            // Calculate 30 weeks corrected date directly
            const daysTo30Weeks = (30 - gestationWeeks) * 7 - gestationDays;
            screeningStart = new Date(dob);
            screeningStart.setDate(screeningStart.getDate() + daysTo30Weeks + 7); // Add 7 days after reaching 30 weeks
        } else if (gestationWeeks < 31) {
            screeningStart = new Date(dob);
            screeningStart.setDate(screeningStart.getDate() + 28);
        } else if (weight <= 1.5 && gestationWeeks < 32) {
            screeningStart = new Date(dob);
            screeningStart.setDate(screeningStart.getDate() + 28);
        } else if (weight <= 1.5 && gestationWeeks < 36) {
            // Calculate 36 weeks corrected date directly
            const daysTo36Weeks = (36 - gestationWeeks) * 7 - gestationDays;
            screeningStart = new Date(dob);
            screeningStart.setDate(screeningStart.getDate() + daysTo36Weeks);
        } else if (weight <= 1.5 && gestationWeeks > 35) {
            screeningStart = new Date(dob);
        } else if (gestationWeeks === 31 && weight > 1.5) {
            screeningStart = "Consider ROP Screening";
        } else {
            screeningStart = "Not Indicated";
        }

        let screeningDue;
        if (screeningStart === "Consider ROP Screening") {
            screeningDue = new Date(dob);
            screeningDue.setDate(screeningDue.getDate() + 35);
        } else if (screeningStart instanceof Date) {
            screeningDue = new Date(screeningStart);
            screeningDue.setDate(screeningDue.getDate() + 7);
        } else {
            screeningDue = screeningStart; // "Not Indicated"
        }

        ropScreening.push({ milestone: 'ROP screening window start', date: screeningStart instanceof Date ? formatDate(screeningStart) : screeningStart });
        ropScreening.push({ milestone: 'First ROP screening due before', date: screeningDue instanceof Date ? formatDate(screeningDue) : screeningDue });

        // Newborn Hearing Screening
        miscellaneousDates.push({ milestone: 'Newborn Hearing Screening', date: 'Before Discharge' });

        // Day 100
        const day100 = new Date(dob);
        day100.setDate(day100.getDate() + 100);
        miscellaneousDates.push({ milestone: 'Day 100 of Life', date: day100 });

        // Research Studies
        if (gestationWeeks < 34) {
            researchStudies.push({ milestone: 'NeoGASTRIC', date: 'Consider participation' });
        }
        if (gestationWeeks < 30) {
            researchStudies.push({ milestone: 'WHEAT', date: 'Consider participation' });
        }
        if (gestationWeeks < 31) {
            researchStudies.push({ milestone: 'BASE', date: 'Consider participation' });
        }
        if (gestationWeeks >= 34 && gestationWeeks <= 38) {
            researchStudies.push({ milestone: 'SurfON', date: 'Consider participation' });
        }

        console.log('Generating table...');
        // Generate output table
        const table = document.createElement('table');
        
        const addGroupToTable = (group, groupName) => {
            console.log(`Adding group: ${groupName}`);
            console.log('Group data:', group);
            
            const groupHeader = document.createElement('tr');
            groupHeader.innerHTML = `<th colspan="2">${groupName}</th>`;
            table.appendChild(groupHeader);

            group.forEach(({ milestone, date, note }) => {
                const row = document.createElement('tr');
                const dateContent = date instanceof Date ? formatDate(date) : date || '';
                row.innerHTML = `<td>${milestone}</td><td>${dateContent}${note ? ` - ${note}` : ''}</td>`;
                table.appendChild(row);
            });
        };

        // Add all groups to table
        try {
            addGroupToTable(correctedGestations, 'Corrected Gestation');
            addGroupToTable(newbornExaminations, 'Newborn Examination');
            addGroupToTable(bloodspotTests, 'Newborn Blood Spot Test');
            addGroupToTable(cranialUltrasounds, 'Cranial Ultrasound');
            addGroupToTable(medications, 'Medication');
            addGroupToTable(feedingGuidelines, 'Feeding - See separate guidelines for cardiac and surgical newborns');
            addGroupToTable(immunisations, 'Immunisations');
            addGroupToTable(ropScreening, 'Retinopathy of Prematurity (ROP) Screening');
            addGroupToTable(miscellaneousDates, 'Miscellaneous Dates');
            addGroupToTable(researchStudies, 'Research Studies');
            
            console.log('Table generated successfully');
            outputDiv.appendChild(table);

            // Save calculation
            const calculationData = {
                patientName: document.getElementById('patientName').value,
                nhsNumber: document.getElementById('nhsNumber').value,
                dob: document.getElementById('dob').value,
                weight: document.getElementById('weight').value,
                gestationWeeks: document.getElementById('gestationWeeks').value,
                gestationDays: document.getElementById('gestationDays').value,
                results: document.getElementById('output').innerHTML
            };

            console.log('Saving calculation...');
            await saveCalculation(calculationData);
            console.log('Calculation saved successfully');
            
        } catch (error) {
            console.error('Error in table generation:', error);
            throw error; // Re-throw to be caught by outer try-catch
        }
    } catch (error) {
        console.error('Error calculating milestones:', error);
        console.error('Error stack:', error.stack);
        alert('An error occurred while calculating milestones. Please check the console for details and try again.');
    }
}

function validatePassword() {
    const password = document.getElementById('passwordInput').value;
    const correctPassword = 'test'; // Replace with your desired password

    if (password === correctPassword) {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainContent').style.display = 'block';
    } else {
        const errorElement = document.getElementById('loginError');
        errorElement.style.display = 'block';
    }
}

function setTodaysDate() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('dob').value = today;
}

function formatForPrint() {
    const printWindow = window.open('', '_blank');
    printWindow.document.write('<html><head><title>Neonatal Care Calculator</title>');
    printWindow.document.write('<style>');
    printWindow.document.write(`
        body { 
            font-family: Arial, sans-serif; 
            margin: 20px; 
            font-size: 11px;
            max-width: 800px;
            margin: 0 auto;
        }
        h1 { 
            text-align: center; 
            color: #005eb8; 
            font-size: 16px; 
            margin-bottom: 15px; 
        }
        .demographics-container {
            display: flex;
            justify-content: space-between;
            margin-bottom: 20px;
            padding: 10px;
            border-bottom: 2px solid #005eb8;
        }
        .demographics-left, .demographics-right {
            flex: 1;
        }
        .demographics-container p {
            margin: 5px 0;
        }
        table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-top: 10px; 
            page-break-inside: auto;
        }
        tr { 
            page-break-inside: avoid; 
            page-break-after: auto;
        }
        th, td { 
            border: 1px solid #ccc; 
            padding: 4px 8px; 
            text-align: left; 
            font-size: 11px; 
        }
        th { 
            background-color: #f2f2f2; 
        }
        @media print {
            body { margin: 15mm; }
            .demographics-container { break-after: avoid; }
        }
    `);
    printWindow.document.write('</style></head><body>');

    // Add title
    printWindow.document.write('<h1>Neonatal Care Calendar</h1>');

    // Add demographics in two columns
    printWindow.document.write('<div class="demographics-container">');
    
    // Left column - Patient details
    printWindow.document.write('<div class="demographics-left">');
    const patientName = document.getElementById('patientName').value;
    const nhsNumber = document.getElementById('nhsNumber').value;
    const dob = new Date(document.getElementById('dob').value).toLocaleDateString('en-GB');
    printWindow.document.write(`<p><strong>Patient Name:</strong> ${patientName}</p>`);
    printWindow.document.write(`<p><strong>NHS Number:</strong> ${nhsNumber}</p>`);
    printWindow.document.write(`<p><strong>Date of Birth:</strong> ${dob}</p>`);
    printWindow.document.write('</div>');
    
    // Right column - Clinical details
    printWindow.document.write('<div class="demographics-right">');
    const weight = document.getElementById('weight').value;
    const gestationWeeks = document.getElementById('gestationWeeks').value;
    const gestationDays = document.getElementById('gestationDays').value;
    printWindow.document.write(`<p><strong>Birth Weight:</strong> ${weight} kg</p>`);
    printWindow.document.write(`<p><strong>Gestation:</strong> ${gestationWeeks}+${gestationDays}</p>`);
    printWindow.document.write('</div>');
    printWindow.document.write('</div>');

    // Add milestones table
    const outputDiv = document.getElementById('output');
    printWindow.document.write(outputDiv.innerHTML);

    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.print();
}

// Initialize app with better error handling
async function initializeApp() {
    try {
        // Initialize IndexedDB first
        await initDB();
        console.log('Database initialized');
        
        // Then load settings
        await loadMilestoneSettings();
        console.log('Settings loaded');
        
        // Hide splash screen only after everything is initialized
        const splashScreen = document.getElementById('splashScreen');
        splashScreen.classList.add('hidden');
        setTimeout(() => {
            splashScreen.style.display = 'none';
            document.getElementById('loginScreen').style.display = 'flex';
        }, 300);
    } catch (error) {
        console.error('Failed to initialize app:', error);
        alert('Error initializing app. Please refresh the page and try again.');
        const splashScreen = document.getElementById('splashScreen');
        splashScreen.classList.add('hidden');
        splashScreen.style.display = 'none';
        document.getElementById('loginScreen').style.display = 'flex';
    }
}

// Start initialization when page loads
window.addEventListener('load', () => {
    initializeApp().catch(error => {
        console.error('Error during initialization:', error);
    });
    
    // Setup offline status detection
    const offlineIndicator = document.getElementById('offlineIndicator');
    const cachedDataNotice = document.getElementById('cachedDataNotice');
    
    function updateOnlineStatus() {
        if (navigator.onLine) {
            offlineIndicator.style.display = 'none';
            cachedDataNotice.style.display = 'none';
            syncOfflineData();
        } else {
            offlineIndicator.style.display = 'block';
            cachedDataNotice.style.display = 'block';
        }
    }

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();
});

// Sync any offline data when back online
async function syncOfflineData() {
    if (!navigator.onLine) return;

    try {
        const calculations = await getCalculations();
        const pendingSync = calculations.filter(calc => calc.needsSync);
        
        if (pendingSync.length > 0) {
            // Here you could implement server sync when needed
            console.log('Syncing offline calculations:', pendingSync.length);
            
            // Mark as synced in IndexedDB
            const transaction = db.transaction(['calculations'], 'readwrite');
            const store = transaction.objectStore('calculations');
            
            for (const calc of pendingSync) {
                calc.needsSync = false;
                await store.put(calc);
            }
        }
    } catch (error) {
        console.error('Error syncing offline data:', error);
    }
}

// New functions for profile management
async function getAllSettingsProfiles() {
    return new Promise((resolve, reject) => {
        try {
            const transaction = db.transaction(['settingsProfiles'], 'readonly');
            const store = transaction.objectStore('settingsProfiles');
            const request = store.getAll();
            
            request.onsuccess = () => {
                resolve(request.result || []);
            };
            
            request.onerror = (event) => {
                console.error('Error getting profiles:', event.target.error);
                reject(event.target.error);
            };
        } catch (error) {
            console.error('Error in getAllSettingsProfiles:', error);
            reject(error);
        }
    });
}

async function getActiveSettingsProfile() {
    return new Promise((resolve, reject) => {
        try {
            const transaction = db.transaction(['settingsProfiles'], 'readonly');
            const store = transaction.objectStore('settingsProfiles');
            const request = store.getAll();
            
            request.onsuccess = () => {
                const profiles = request.result || [];
                const activeProfile = profiles.find(profile => profile.isActive) || profiles[0];
                resolve(activeProfile);
            };
            
            request.onerror = (event) => {
                console.error('Error getting active profile:', event.target.error);
                reject(event.target.error);
            };
        } catch (error) {
            console.error('Error in getActiveSettingsProfile:', error);
            reject(error);
        }
    });
}

async function saveSettingsProfile(profileName, isNew = false) {
    return new Promise(async (resolve, reject) => {
        try {
            // Get form values
            const settings = {
                cranialUltrasound: {
                    gestation: parseFloat(document.getElementById('cranialUltrasoundGestation').value) || DEFAULT_SETTINGS.cranialUltrasound.gestation,
                    weight: parseFloat(document.getElementById('cranialUltrasoundWeight').value) || DEFAULT_SETTINGS.cranialUltrasound.weight,
                    followUpGestation: parseFloat(document.getElementById('cranialUltrasoundFollowUpGestation').value) || DEFAULT_SETTINGS.cranialUltrasound.followUpGestation,
                    followUpWeight: parseFloat(document.getElementById('cranialUltrasoundFollowUpWeight').value) || DEFAULT_SETTINGS.cranialUltrasound.followUpWeight,
                    initialDay: parseInt(document.getElementById('cranialUltrasoundInitialDay').value) || DEFAULT_SETTINGS.cranialUltrasound.initialDay,
                    followUpDay: parseInt(document.getElementById('cranialUltrasoundFollowUpDay').value) || DEFAULT_SETTINGS.cranialUltrasound.followUpDay
                },
                medications: {
                    hydrocortisoneGestation: parseFloat(document.getElementById('hydrocortisoneGestation').value) || DEFAULT_SETTINGS.medications.hydrocortisoneGestation,
                    hydrocortisoneReviewDay: parseInt(document.getElementById('hydrocortisoneReviewDay').value) || DEFAULT_SETTINGS.medications.hydrocortisoneReviewDay,
                    probioticsGestation: parseFloat(document.getElementById('probioticsGestation').value) || DEFAULT_SETTINGS.medications.probioticsGestation,
                    probioticsWeight: parseFloat(document.getElementById('probioticsWeight').value) || DEFAULT_SETTINGS.medications.probioticsWeight,
                    caffeineGestation: parseFloat(document.getElementById('caffeineGestation').value) || DEFAULT_SETTINGS.medications.caffeineGestation,
                    caffeineReviewGestation: parseFloat(document.getElementById('caffeineReviewGestation').value) || DEFAULT_SETTINGS.medications.caffeineReviewGestation,
                    sytronWeight: parseFloat(document.getElementById('sytronWeight').value) || DEFAULT_SETTINGS.medications.sytronWeight,
                    sytronStartDay: parseInt(document.getElementById('sytronStartDay').value) || DEFAULT_SETTINGS.medications.sytronStartDay
                },
                feeding: {
                    pnGestation: parseFloat(document.getElementById('pnGestation').value) || DEFAULT_SETTINGS.feeding.pnGestation,
                    pnWeight: parseFloat(document.getElementById('pnWeight').value) || DEFAULT_SETTINGS.feeding.pnWeight,
                    trophicGestation: parseFloat(document.getElementById('trophicGestation').value) || DEFAULT_SETTINGS.feeding.trophicGestation,
                    trophicWeight: parseFloat(document.getElementById('trophicWeight').value) || DEFAULT_SETTINGS.feeding.trophicWeight,
                    breastMilkIncrementGestation: parseFloat(document.getElementById('breastMilkIncrementGestation').value) || DEFAULT_SETTINGS.feeding.breastMilkIncrementGestation,
                    breastMilkIncrementWeight: parseFloat(document.getElementById('breastMilkIncrementWeight').value) || DEFAULT_SETTINGS.feeding.breastMilkIncrementWeight,
                    fortifierGestation: parseFloat(document.getElementById('fortifierGestation').value) || DEFAULT_SETTINGS.feeding.fortifierGestation,
                    formulaAvoidGestation: parseFloat(document.getElementById('formulaAvoidGestation').value) || DEFAULT_SETTINGS.feeding.formulaAvoidGestation,
                    formulaAvoidWeight: parseFloat(document.getElementById('formulaAvoidWeight').value) || DEFAULT_SETTINGS.feeding.formulaAvoidWeight,
                    fullEnteralGestation: parseFloat(document.getElementById('fullEnteralGestation').value) || DEFAULT_SETTINGS.feeding.fullEnteralGestation,
                    fullEnteralWeight: parseFloat(document.getElementById('fullEnteralWeight').value) || DEFAULT_SETTINGS.feeding.fullEnteralWeight,
                    breastMilkAdvancement: {
                        standardIncrement: parseFloat(document.getElementById('breastMilkStandardIncrement').value) || DEFAULT_SETTINGS.feeding.breastMilkAdvancement.standardIncrement,
                        slowIncrement: parseFloat(document.getElementById('breastMilkSlowIncrement').value) || DEFAULT_SETTINGS.feeding.breastMilkAdvancement.slowIncrement
                    },
                    formulaAdvancement: {
                        standardIncrement: parseFloat(document.getElementById('formulaStandardIncrement').value) || DEFAULT_SETTINGS.feeding.formulaAdvancement.standardIncrement,
                        slowIncrement: parseFloat(document.getElementById('formulaSlowIncrement').value) || DEFAULT_SETTINGS.feeding.formulaAdvancement.slowIncrement
                    }
                }
            };

            // Check for duplicate name first
            const profiles = await getAllSettingsProfiles();
            
            // If creating new profile, check if name exists
            if (isNew && profiles.some(profile => profile.name === profileName)) {
                reject(new Error(`A profile named "${profileName}" already exists.`));
                return;
            }
            
            // If updating existing profile, check if name changed and would conflict
            if (!isNew) {
                const activeProfile = profiles.find(p => p.isActive);
                if (activeProfile && activeProfile.name !== profileName) {
                    if (profiles.some(p => p !== activeProfile && p.name === profileName)) {
                        reject(new Error(`A profile named "${profileName}" already exists.`));
                        return;
                    }
                }
            }

            // If creating a new profile, first set all profiles inactive
            if (isNew) {
                await setAllProfilesInactive();
            }
            
            // Create a transaction for adding/updating the profile
            const transaction = db.transaction(['settingsProfiles'], 'readwrite');
            const store = transaction.objectStore('settingsProfiles');
            
            // Transaction success/error handlers
            transaction.oncomplete = () => resolve(true);
            transaction.onerror = (event) => {
                console.error('Transaction error in saveSettingsProfile:', event.target.error);
                reject(event.target.error);
            };
            
            // If saving new profile
            if (isNew) {
                // Add new profile
                const newProfile = {
                    name: profileName,
                    isActive: true,  // Make this the active profile
                    settings: settings,
                    createdAt: new Date().toISOString(),
                    lastModified: new Date().toISOString()
                };
                
                store.add(newProfile);
            } 
            // Updating existing profile
            else {
                // Get the current active profile
                const activeProfile = profiles.find(p => p.isActive);
                
                if (!activeProfile) {
                    reject(new Error("No active profile found to update."));
                    return;
                }
                
                // Update the profile
                activeProfile.name = profileName;
                activeProfile.settings = settings;
                activeProfile.lastModified = new Date().toISOString();
                
                store.put(activeProfile);
            }
        } catch (error) {
            console.error('Error saving settings profile:', error);
            reject(error);
        }
    });
}

async function setAllProfilesInactive() {
    return new Promise(async (resolve, reject) => {
        try {
            const profiles = await getAllSettingsProfiles();
            const transaction = db.transaction(['settingsProfiles'], 'readwrite');
            const store = transaction.objectStore('settingsProfiles');
            
            let completed = 0;
            
            // Transaction success/error handlers
            transaction.oncomplete = () => resolve(true);
            transaction.onerror = (event) => reject(event.target.error);
            
            // Process each profile
            profiles.forEach(profile => {
                profile.isActive = false;
                const request = store.put(profile);
                
                request.onsuccess = () => {
                    completed++;
                    console.log(`Set profile ${profile.name} inactive: ${completed} of ${profiles.length}`);
                };
                
                request.onerror = (event) => {
                    console.error(`Error setting profile ${profile.name} inactive:`, event.target.error);
                    // Error will be caught by transaction.onerror
                };
            });
            
            // If there are no profiles to update, resolve immediately
            if (profiles.length === 0) {
                resolve(true);
            }
        } catch (error) {
            console.error('Error in setAllProfilesInactive:', error);
            reject(error);
        }
    });
}

async function activateSettingsProfile(profileId) {
    try {
        // First set all profiles as inactive
        await setAllProfilesInactive();
        
        // Then set the selected profile as active
        const transaction = db.transaction(['settingsProfiles'], 'readwrite');
        const store = transaction.objectStore('settingsProfiles');
        
        const getRequest = store.get(parseInt(profileId));
        const profile = await new Promise((resolve, reject) => {
            getRequest.onsuccess = () => resolve(getRequest.result);
            getRequest.onerror = () => reject(getRequest.error);
        });
        
        if (!profile) {
            throw new Error(`Profile with ID ${profileId} not found.`);
        }
        
        profile.isActive = true;
        
        const updateRequest = store.put(profile);
        await new Promise((resolve, reject) => {
            updateRequest.onsuccess = () => resolve();
            updateRequest.onerror = () => reject(updateRequest.error);
        });
        
        // Load the activated profile into the form
        loadProfileIntoForm(profile);
        
        return true;
    } catch (error) {
        console.error('Error activating profile:', error);
        throw error;
    }
}

async function deleteSettingsProfile(profileId) {
    try {
        // Get all profiles to check if we're deleting the active one
        const profiles = await getAllSettingsProfiles();
        const profileToDelete = profiles.find(p => p.id === parseInt(profileId));
        
        if (!profileToDelete) {
            throw new Error(`Profile with ID ${profileId} not found.`);
        }
        
        // Check we have at least one profile left after deletion
        if (profiles.length <= 1) {
            throw new Error("Cannot delete the only profile. Create another profile first.");
        }
        
        // Delete the profile
        const transaction = db.transaction(['settingsProfiles'], 'readwrite');
        const store = transaction.objectStore('settingsProfiles');
        
        await store.delete(parseInt(profileId));
        
        // If we deleted the active profile, activate another one
        if (profileToDelete.isActive) {
            const remainingProfiles = profiles.filter(p => p.id !== parseInt(profileId));
            if (remainingProfiles.length > 0) {
                await activateSettingsProfile(remainingProfiles[0].id);
            }
        }
        
        return true;
    } catch (error) {
        console.error('Error deleting profile:', error);
        throw error;
    }
}

function loadProfileIntoForm(profile) {
    const settings = profile.settings;
    
    // Cranial Ultrasound settings
    document.getElementById('cranialUltrasoundGestation').value = settings.cranialUltrasound.gestation;
    document.getElementById('cranialUltrasoundWeight').value = settings.cranialUltrasound.weight;
    document.getElementById('cranialUltrasoundInitialDay').value = settings.cranialUltrasound.initialDay;
    document.getElementById('cranialUltrasoundFollowUpDay').value = settings.cranialUltrasound.followUpDay;
    document.getElementById('cranialUltrasoundFollowUpGestation').value = settings.cranialUltrasound.followUpGestation;
    document.getElementById('cranialUltrasoundFollowUpWeight').value = settings.cranialUltrasound.followUpWeight;
    
    // Medication settings
    document.getElementById('hydrocortisoneGestation').value = settings.medications.hydrocortisoneGestation;
    document.getElementById('hydrocortisoneReviewDay').value = settings.medications.hydrocortisoneReviewDay;
    document.getElementById('probioticsGestation').value = settings.medications.probioticsGestation;
    document.getElementById('probioticsWeight').value = settings.medications.probioticsWeight;
    document.getElementById('caffeineGestation').value = settings.medications.caffeineGestation;
    document.getElementById('caffeineReviewGestation').value = settings.medications.caffeineReviewGestation;
    document.getElementById('sytronWeight').value = settings.medications.sytronWeight;
    document.getElementById('sytronStartDay').value = settings.medications.sytronStartDay;
    
    // Feeding settings
    document.getElementById('pnGestation').value = settings.feeding.pnGestation;
    document.getElementById('pnWeight').value = settings.feeding.pnWeight;
    document.getElementById('trophicGestation').value = settings.feeding.trophicGestation;
    document.getElementById('trophicWeight').value = settings.feeding.trophicWeight;
    document.getElementById('breastMilkIncrementGestation').value = settings.feeding.breastMilkIncrementGestation;
    document.getElementById('breastMilkIncrementWeight').value = settings.feeding.breastMilkIncrementWeight;
    document.getElementById('fortifierGestation').value = settings.feeding.fortifierGestation;
    document.getElementById('formulaAvoidGestation').value = settings.feeding.formulaAvoidGestation;
    document.getElementById('formulaAvoidWeight').value = settings.feeding.formulaAvoidWeight;
    document.getElementById('fullEnteralGestation').value = settings.feeding.fullEnteralGestation;
    document.getElementById('fullEnteralWeight').value = settings.feeding.fullEnteralWeight;
    
    // Make sure to handle nested objects safely
    if (settings.feeding.breastMilkAdvancement) {
        document.getElementById('breastMilkStandardIncrement').value = settings.feeding.breastMilkAdvancement.standardIncrement;
        document.getElementById('breastMilkSlowIncrement').value = settings.feeding.breastMilkAdvancement.slowIncrement;
    }
    
    if (settings.feeding.formulaAdvancement) {
        document.getElementById('formulaStandardIncrement').value = settings.feeding.formulaAdvancement.standardIncrement;
        document.getElementById('formulaSlowIncrement').value = settings.feeding.formulaAdvancement.slowIncrement;
    }
    
    // Update the profile name field
    const profileNameInput = document.getElementById('profileName');
    if (profileNameInput) {
        profileNameInput.value = profile.name;
    }
}

// Load profiles into the profile selector
async function loadProfileSelector() {
    try {
        const profiles = await getAllSettingsProfiles();
        const profileSelector = document.getElementById('profileSelector');
        
        if (!profileSelector) return;
        
        // Clear previous options
        profileSelector.innerHTML = '';
        
        // Add options for each profile
        profiles.forEach(profile => {
            const option = document.createElement('option');
            option.value = profile.id;
            option.textContent = profile.name;
            option.selected = profile.isActive;
            profileSelector.appendChild(option);
        });
        
        // Update the profile name field with the active profile name
        const activeProfile = profiles.find(p => p.isActive) || profiles[0];
        if (activeProfile) {
            document.getElementById('profileName').value = activeProfile.name;
        }
    } catch (error) {
        console.error('Error loading profile selector:', error);
    }
}

// Profile management UI functions
async function handleProfileChange() {
    try {
        const profileSelector = document.getElementById('profileSelector');
        if (!profileSelector) return;
        
        const selectedProfileId = profileSelector.value;
        if (!selectedProfileId) return;
        
        await activateSettingsProfile(selectedProfileId);
        
        // Update the UI to reflect the change
        loadProfileSelector();
    } catch (error) {
        console.error('Error changing profile:', error);
        alert(`Failed to change profile: ${error.message}`);
    }
}

async function saveCurrentProfile() {
    try {
        // Get profile name from the input field
        const profileNameInput = document.getElementById('profileName');
        const profileName = profileNameInput.value.trim();
        
        if (!profileName) {
            alert('Please enter a profile name.');
            profileNameInput.focus();
            return;
        }
        
        await saveSettingsProfile(profileName, false);
        
        // Refresh the selector
        await loadProfileSelector();
        
        alert(`Profile "${profileName}" saved successfully.`);
    } catch (error) {
        console.error('Error saving profile:', error);
        alert(`Failed to save profile: ${error.message}`);
    }
}

async function createNewProfile() {
    try {
        // Get profile name from the input field
        const profileNameInput = document.getElementById('profileName');
        const profileName = profileNameInput.value.trim();
        
        if (!profileName) {
            alert('Please enter a name for the new profile.');
            profileNameInput.focus();
            return;
        }
        
        // Confirm creation
        if (!confirm(`Create a new profile named "${profileName}"?`)) {
            return;
        }
        
        await saveSettingsProfile(profileName, true);
        
        // Refresh the selector
        await loadProfileSelector();
        
        alert(`New profile "${profileName}" created successfully.`);
    } catch (error) {
        console.error('Error creating profile:', error);
        alert(`Failed to create profile: ${error.message}`);
    }
}

async function deleteCurrentProfile() {
    try {
        const profileSelector = document.getElementById('profileSelector');
        if (!profileSelector || !profileSelector.value) {
            alert('Please select a profile to delete.');
            return;
        }
        
        const selectedOption = profileSelector.options[profileSelector.selectedIndex];
        const profileName = selectedOption.textContent;
        const profileId = profileSelector.value;
        
        // Confirm deletion
        if (!confirm(`Are you sure you want to delete the profile "${profileName}"? This cannot be undone.`)) {
            return;
        }
        
        await deleteSettingsProfile(profileId);
        
        // Refresh the selector
        await loadProfileSelector();
        
        alert(`Profile "${profileName}" deleted successfully.`);
    } catch (error) {
        console.error('Error deleting profile:', error);
        alert(`Failed to delete profile: ${error.message}`);
    }
}