import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import logo from './logo.png';

function App() {
  const [map, setMap] = useState(null);
  const [origin, setOrigin] = useState(null);
  const [dest, setDest] = useState(null);
  const [directionsService, setDirService] = useState(null);
  const [directionsRender, setDirRender] = useState(null);
  const [lastLat, setLastLat] = useState(0);
  const [lastLng, setLastLng] = useState(0);
  const [nearByPlaces, setNearByPlaces] = useState([]);
  const [markers, setMarkers] = useState([]);
  const [message, setMessage] = useState('');

  const getMessage = async () => {
    const res = await axios.get('https://cors-server-sepia.vercel.app/message');
    console.log('getmessage', res)
    setMessage(res.data);
  };

  useEffect(() => {
    getMessage();
  }, [message]);

  function addMarker(place) {
    const marker = new window.google.maps.Marker({
      position: place.geometry.location,
      title: place.name,
      map: map,
    });
    setMarkers([...markers, marker]);
  }

  function setMapOnAll(map) {
    for (const marker of markers) {
      marker.setMap(map);
    }
  }

  function hideMarkers() {
    setMapOnAll(null);
  }

  useEffect(() => {
    if (origin) {
      addMarker(origin);
    }
  }, [origin]);

  useEffect(() => {
    if (dest) {
      addMarker(dest);
    }
  }, [dest]);

  useEffect(() => {
    const location = {
      lat: 40.0,
      lng: -79.0,
    };
    const options = {
      center: location,
      zoom: 12,
    };
    if (navigator.geolocation) {
      console.log('geo is here');
      navigator.geolocation.getCurrentPosition(
        (loc) => {
          location.lat = loc.coords.latitude;
          location.lng = loc.coords.longitude;

          setMap(
            new window.google.maps.Map(document.getElementById('map'), options)
          );
        },
        (err) => {
          console.log('nope', err);
          setMap(
            new window.google.maps.Map(document.getElementById('map'), options)
          );
        }
      );
    } else {
      console.log('geo not supported');
      setMap(
        new window.google.maps.Map(document.getElementById('map'), options)
      );
    }
    const autocompleteOrigin = new window.google.maps.places.Autocomplete(
      document.getElementById('origin-input'),
      {
        componentRestrictions: { country: ['us'] },
        fields: ['geometry', 'name'],
      }
    );
    const autocompleteDest = new window.google.maps.places.Autocomplete(
      document.getElementById('destination-input'),
      {
        componentRestrictions: { country: ['us'] },
        fields: ['geometry', 'name'],
      }
    );
    autocompleteOrigin.addListener('place_changed', () => {
      setOrigin(autocompleteOrigin.getPlace());
    });
    autocompleteDest.addListener('place_changed', () => {
      setDest(autocompleteDest.getPlace());
    });
    setDirService(new window.google.maps.DirectionsService());
    setDirRender(new window.google.maps.DirectionsRenderer());
  }, []);

  const findLastStep = (halfWay, dir) => {
    let total = 0;
    let newSteps = [];
    for (let i = 0; i < dir.length; i++) {
      let step = dir[i];
      newSteps.push(step);
      total += step.distance.value;
      if (total > halfWay) {
        //dig into last step and find halfway point for accuracy
        return newSteps;
      }
    }
  };

  function takeMeThere(place) {
    hideMarkers();
    directionsService
      .route({
        origin: {
          query: origin.name,
        },
        destination: {
          lat: place.lat,
          lng: place.lng,
        },
        travelMode: window.google.maps.TravelMode.WALKING,
      })
      .then((response) => {
        console.log('THEN');
        directionsRender.setMap(map);
        directionsRender.setDirections(response);
      });
  }

  function calculateAndDisplayRoute() {
    directionsService
      .route({
        origin: {
          lat: origin.geometry.location.lat(),
          lng: origin.geometry.location.lng(),
        },
        destination: {
          lat: dest.geometry.location.lat(),
          lng: dest.geometry.location.lng(),
        },
        //refactor for other modes of transport
        travelMode: window.google.maps.TravelMode.WALKING,
      })
      .then((response) => {
        const steps = response.routes[0].legs[0].steps;
        const distance = response.routes[0].legs[0].distance.value;
        const half = distance / 2;
        let newSteps = findLastStep(half, steps);
        response.routes[0].legs[0].steps = newSteps;
        const last = newSteps[newSteps.length - 1];
        setLastLat(last.start_location.lat());
        setLastLng(last.start_location.lng());
        const halfwayMark = new window.google.maps.Marker({
          position: last.end_location,
          map: map,
        });
        setMarkers([...markers, halfwayMark]);
        directionsRender.setMap(map);
        directionsRender.setDirections(response);
      })
      .catch((e) =>
        window.alert('Directions request failed due to ' + e.status)
      );
  }

  const getPlaces = async (_lat, _lng) => {
    try {
      const res = await axios.get(`https://cors-server-sepia.vercel.app/getPlaces?lat=${_lat}&lng=${_lng}`);
      return res.data;
    } catch (err) {
      console.log(err);
    }
  };
  async function findPlaces(lat, lng) {
    setNearByPlaces([]);
    try {
       await getPlaces(lat, lng)
      .then((response) => {
        console.log(response);
        const places = response.results;
        const service = new window.google.maps.places.PlacesService(map);
        places.forEach((place) => {
          const request = {
            placeId: place.place_id,
            fields: ['url', 'website'],
          };

          service.getDetails(request, callback);

          function callback(_place, status) {
            if (status == window.google.maps.places.PlacesServiceStatus.OK) {
              // console.log('place', place);
              let nearByPlace = {
                name: place.name,
                url: _place.url,
                website: _place.website,
                lat: place.geometry.location.lat,
                lng: place.geometry.location.lng,
              };
              setNearByPlaces((prevArr) => [...prevArr, nearByPlace]);
            }
          }
        });
      });
    } catch (err) {
      console.log(err);
    }
  }

  const nearByPlacesDiv = nearByPlaces?.map((place) => {
    return (
      <div className="places_results">
        <div style={{ margin: '14px' }}>{place.name}</div>
        <div style={{ margin: '8px' }}>
          <a href={place.url} target="_blank">
            Listing
          </a>
        </div>
        <div style={{ margin: '8px' }}>
          <a href={place.website} target="_blank">
            Website
          </a>
        </div>
        <button onClick={() => takeMeThere(place)} style={{ margin: '8px' }}>
          Take Me There
        </button>
      </div>
    );
  });

  return (
    <div className="App">
      <div className="nav">
        <img src={logo} />
      </div>
      {/* {message ? message : 'no message'} */}
      <div id="container">
        <div id="map" />

        <div id="floating-panel">
          <input id="origin-input" placeholder="Location 1" />
          <input id="destination-input" placeholder="Location 2" />
          <button id="get_route" onClick={() => calculateAndDisplayRoute()}>
            Halfway Point
          </button>
          <button id="find_places" onClick={() => findPlaces(lastLat, lastLng)}>
            Find Places
          </button>
        </div>
        <div id="places">
          Where to??
          {nearByPlacesDiv}
        </div>
      </div>
    </div>
  );
}

export default App;
