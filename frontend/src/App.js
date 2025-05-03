import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './App.css';

// Fix default marker icon
const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = defaultIcon;

function AccidentAlerts({ data }) {
  if (!data) return null;

  const getAlertClass = (intervention) => {
    switch (intervention) {
      case 'No intervention required':
        return 'normal';
      case 'Insurance':
        return 'minor';
      case 'Police and Civil Protection':
        return 'severe';
      default:
        return '';
    }
  };

  const getAlertTitle = (intervention) => {
    switch (intervention) {
      case 'No intervention required':
        return 'Accident Normal - Constat Simple';
      case 'Insurance':
        return 'Accident Modéré - Blessures Légères';
      case 'Police and Civil Protection':
        return 'Accident Grave - Intervention Urgente';
      default:
        return 'État Inconnu';
    }
  };

  return (
    <div className={`accident-alert ${getAlertClass(data.intervention)}`}>
      <h3>{getAlertTitle(data.intervention)}</h3>
      <div className="accident-details">
        <p><strong>Vitesse:</strong> {data.iot_data.speed} km/h</p>
        <p><strong>Impact:</strong> {data.iot_data.impact.toFixed(2)}</p>
        <p><strong>Localisation:</strong> {data.iot_data.location.latitude.toFixed(4)}, {data.iot_data.location.longitude.toFixed(4)}</p>
      </div>
    </div>
  );
}

function getInterventionLabel(intervention) {
  if (typeof intervention === 'number') {
    if (intervention >= 7.0) return 'A - Police et Protection Civile (SAMU)';
    if (intervention > 4.0) return 'B - Police et Protection Civile';
    return 'C - Juste un rapport';
  }
  return intervention || 'Non défini';
}

function getEmergencyNumbers(intervention) {
  if (intervention.startsWith('A')) return ['SAMU : 190'];
  if (intervention.startsWith('B')) return ['Police : 197', 'Protection Civile : 198'];
  return [];
}

function AccidentMap({ accidents }) {
  if (!accidents || accidents.length === 0) {
    return <div className="map-container">Chargement de la carte...</div>;
  }
  return (
    <div className="map-container" style={{ height: '600px', width: '100%' }}>
      <MapContainer 
        center={[33.5, 7.5]} // Centre sur le Maghreb
        zoom={5} 
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        {accidents.map((accident, index) => (
          <Marker 
            key={index} 
            position={[33.5, 7.5]} // Position fixe pour tous les accidents
          >
            <Popup>
              <div>
                <h3>Détails de l'Accident</h3>
                <p><strong>Vitesse:</strong> {accident.speed} km/h</p>
                {[...Array(8)].map((_, i) => (
                  <p key={i}><strong>Capteur {i+1}:</strong> {accident[`capteur${i}`]}</p>
                ))}
                <p><strong>Impact max:</strong> {accident.impact}</p>
                <p><strong>Matricule:</strong> {accident.matricule}</p>
                <p><strong>Châssis:</strong> {accident.numero_chassis}</p>
                <p><strong>Propriétaire:</strong> {accident.proprietaire}</p>
                <p><strong>Intervention:</strong> <span style={{color: 'blue', fontWeight: 'bold'}}>{getInterventionLabel(accident.intervention)}</span></p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

function App() {
  const [accidents, setAccidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [error, setError] = useState(null);

  // Charger les accidents depuis le backend
  const fetchAccidents = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('http://127.0.0.1:5000/historical-data');
      if (!response.ok) throw new Error('Erreur réseau: ' + response.status);
      const data = await response.json();
      const formatted = data.historical_data.map(row => ({
        id: row[0],
        speed: row[1],
        impact: row[2],
        latitude: row[3],
        longitude: row[4],
        intervention: row[5],
      }));
      setAccidents(formatted);
      if (formatted.length === 0) setError('Aucun accident trouvé dans la base de données.');
    } catch (error) {
      setError('Erreur lors du chargement des accidents: ' + error.message);
    }
    setLoading(false);
  };

  // Simuler un accident et recharger la liste
  const simulateAccident = async () => {
    setSimulating(true);
    setError(null);
    try {
      const response = await fetch('http://127.0.0.1:5000/simulate-and-log-accident', { method: 'POST' });
      if (!response.ok) throw new Error('Erreur réseau: ' + response.status);
      const data = await response.json();
      await fetchAccidents();

      // Déclencher une alerte avec la nature de l'intervention et les numéros d'urgence
      const emergencyNumbers = getEmergencyNumbers(data.intervention);
      alert(`Nature de l'intervention : ${data.intervention}\nNuméros d'urgence :\n${emergencyNumbers.join('\n')}`);
    } catch (error) {
      setError('Erreur lors de la simulation: ' + error.message);
    }
    setSimulating(false);
  };

  useEffect(() => {
    fetchAccidents();
  }, []);

  return (
    <div className="App">
      <h1>Système de Détection d'Accidents</h1>
      <button onClick={simulateAccident} disabled={simulating} style={{marginBottom: 20, padding: '10px 20px', fontSize: 16}}>
        {simulating ? 'Simulation en cours...' : 'Simuler un accident'}
      </button>
      {error && (
        <div style={{color: 'red', marginBottom: 10}}>{error}</div>
      )}
      {loading ? (
        <div>Chargement des accidents...</div>
      ) : accidents.length === 0 ? (
        <div>Aucun accident enregistré.</div>
      ) : (
        <AccidentMap accidents={accidents} />
      )}
    </div>
  );
}

export default App;
