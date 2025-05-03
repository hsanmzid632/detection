from flask import Flask, request, jsonify
import random
import pickle
import os
import sqlite3
from sklearn.ensemble import RandomForestClassifier
import numpy as np
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Simulate IoT data
def generate_iot_data():
    # 8 capteurs de choc : 2 avant, 2 arrière, 1 par porte
    capteurs = [round(random.uniform(1, 10), 2) for _ in range(8)]  # Valeurs réalistes entre 1 et 10
    return {
        "speed": random.randint(20, 150),  # Vitesse réaliste entre 20 et 150 km/h
        "impact": max(capteurs),  # Impact basé sur le capteur le plus élevé
        "capteurs": capteurs,
        "matricule": f"{random.randint(1000,9999)}-TU-{random.randint(10,99)}",
        "numero_chassis": f"CHS{random.randint(100000,999999)}",
        "proprietaire": random.choice(["Ali Ben Salah", "Sami Trabelsi", "Mouna Jaziri", "Fatma Bouzid"])
    }

# Load or train a machine learning model
MODEL_PATH = "model.pkl"
if os.path.exists(MODEL_PATH):
    with open(MODEL_PATH, "rb") as f:
        model = pickle.load(f)
else:
    # Train a simple model on simulated data
    X = np.random.rand(100, 2)  # Features: speed and impact
    y = np.random.choice(["Police and Civil Protection", "Insurance", "No intervention required"], size=100)
    model = RandomForestClassifier()
    model.fit(X, y)
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(model, f)

# Initialize SQLite database
def init_db():
    conn = sqlite3.connect('accidents.db')
    cursor = conn.cursor()
    cursor.execute('''DROP TABLE IF EXISTS accidents''')
    cursor.execute('''CREATE TABLE IF NOT EXISTS accidents (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        speed INTEGER,
                        impact REAL,
                        capteur0 REAL,
                        capteur1 REAL,
                        capteur2 REAL,
                        capteur3 REAL,
                        capteur4 REAL,
                        capteur5 REAL,
                        capteur6 REAL,
                        capteur7 REAL,
                        matricule TEXT,
                        numero_chassis TEXT,
                        proprietaire TEXT,
                        intervention TEXT
                    )''')
    conn.commit()
    conn.close()

init_db()

# Endpoint to receive IoT data
@app.route('/simulate-accident', methods=['GET'])
def simulate_accident():
    data = generate_iot_data()
    # Placeholder for ML model processing
    intervention = classify_intervention(data)
    return jsonify({"iot_data": data, "intervention": intervention})

# Endpoint to log accident data
@app.route('/log-accident', methods=['POST'])
def log_accident():
    data = request.json
    conn = sqlite3.connect('accidents.db')
    cursor = conn.cursor()
    cursor.execute('''INSERT INTO accidents (speed, impact, latitude, longitude, intervention)
                      VALUES (?, ?, ?, ?, ?)''',
                   (data['speed'], data['impact'], data['latitude'], data['longitude'], data['intervention']))
    conn.commit()
    conn.close()
    return jsonify({"message": "Accident logged successfully"}), 201

# Endpoint to fetch historical accident data
@app.route('/historical-data', methods=['GET'])
def historical_data():
    conn = sqlite3.connect('accidents.db')
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM accidents')
    rows = cursor.fetchall()
    conn.close()
    return jsonify({"historical_data": rows})

# Update classify_intervention to use the ML model
def classify_intervention(data):
    # Seuils personnalisés pour l'intervention
    seuil_rapport = 4.0
    seuil_samu = 7.0
    if data['impact'] >= seuil_samu:
        return "A - Police et Protection Civile (SAMU)"
    elif data['impact'] > seuil_rapport:
        return "B - Police et Protection Civile"
    else:
        return "C - Juste un rapport"

@app.route('/simulate-and-log-accident', methods=['POST'])
def simulate_and_log_accident():
    data = generate_iot_data()
    intervention = classify_intervention(data)
    conn = sqlite3.connect('accidents.db')
    cursor = conn.cursor()
    cursor.execute('''INSERT INTO accidents (speed, impact, capteur0, capteur1, capteur2, capteur3, capteur4, capteur5, capteur6, capteur7, matricule, numero_chassis, proprietaire, intervention)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                   (data['speed'], data['impact'], *data['capteurs'], data['matricule'], data['numero_chassis'], data['proprietaire'], intervention))
    conn.commit()
    conn.close()
    return jsonify({"message": "Simulated accident logged successfully", "iot_data": data, "intervention": intervention})

@app.route('/simulate-multiple-accidents', methods=['GET'])
def simulate_multiple_accidents():
    accidents = []
    # Generate 4 random accidents with different severity levels
    for _ in range(4):
        data = generate_iot_data()
        intervention = classify_intervention(data)
        
        # Store in database
        conn = sqlite3.connect('accidents.db')
        cursor = conn.cursor()
        cursor.execute('''INSERT INTO accidents (speed, impact, latitude, longitude, intervention)
                          VALUES (?, ?, ?, ?, ?)''',
                       (data['speed'], data['impact'], data['location']['latitude'], 
                        data['location']['longitude'], intervention))
        conn.commit()
        conn.close()
        
        accidents.append({
            "iot_data": data,
            "intervention": intervention
        })
    
    return jsonify({"accidents": accidents})

@app.route('/clear-accidents', methods=['POST'])
def clear_accidents():
    conn = sqlite3.connect('accidents.db')
    cursor = conn.cursor()
    cursor.execute('DELETE FROM accidents')
    conn.commit()
    conn.close()
    return jsonify({"message": "All accidents deleted."})

if __name__ == '__main__':
    app.run(debug=True)