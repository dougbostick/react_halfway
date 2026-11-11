import { useState, useEffect } from 'react';
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

  /*
    main use effect
    1. creates new map object, set view to current position
    2. creates autocomplete objects and attaches them to inputs
    3. attaches google maps event listener to autocomplete inputs
    4. sets up directions services
  */
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
    // create autocomplete objects and attach them to the inputs
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

    // add Google Maps event listeners to autocomplete
    // place_changed is a specific google maps event
    // getPlace() returns the fields established in the Autocomplete setup
    autocompleteOrigin.addListener('place_changed', () => {
      setOrigin(autocompleteOrigin.getPlace());
    });
    autocompleteDest.addListener('place_changed', () => {
      setDest(autocompleteDest.getPlace());
    });

    // DirectionsService asks google for directions between two points
    setDirService(new window.google.maps.DirectionsService());

    /* 
      DirectionsRenderer takes a DirectionsResult, which is returned from
      DirectionsService.route(). Has the ability to draw the direcitons on map
      using markers.
    */
    setDirRender(new window.google.maps.DirectionsRenderer());
  }, []);

  /* 
    listeners for when we set an origin or destination
    origin and dest objects:
    { gemoetry, name }
  */  
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

  // creates a new marker and draws it on the map
  function addMarker(place) {
    const marker = new window.google.maps.Marker({
      position: place.geometry.location,
      title: place.name,
      map: map,
    });
    setMarkers([...markers, marker]);
  }

  /* 
    loops overs the markers state and tells which map the marker should appear on
    this is only used with a null arg, so it clears the markers
  */ 
  function setMapOnAll(map) {
    for (const marker of markers) {
      marker.setMap(map);
    }
  }

  function hideMarkers() {
    setMapOnAll(null);
  }

  // function attached to Halfway Point button
  function calculateAndDisplayRoute() {
    // takes the coordinates of the origin and dest, calculates directions
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
      .then((response) => { // response is a DirectionsResult object
        // grab the seeries of directions
        const steps = response.routes[0].legs[0].steps;
        // grab the total distance of the route
        const distance = response.routes[0].legs[0].distance.value;
        const half = distance / 2;
        // set of steps based on origin to halfway point
        const newSteps = findLastStep(half, steps);
        // reassign the steps in our route to the newly created halfway route
        response.routes[0].legs[0].steps = newSteps;
        const last = newSteps[newSteps.length - 1];
        /*
          each step is a single piece of directions
          e.g. turn left on main street
          there is a starting and ending coordinate to each step.

          here we get to coordinates of the last step to pass to find places
        */ 
        setLastLat(last.start_location.lat());
        setLastLng(last.start_location.lng());

        const halfwayMark = new window.google.maps.Marker({
          position: last.end_location,
          map: map,
        });
        // keeping track of all markers so they can be cleared
        setMarkers([...markers, halfwayMark]);

        // render our halfway point directions on the map
        directionsRender.setMap(map);
        directionsRender.setDirections(response);
      })
      .catch((e) =>
        window.alert('Directions request failed due to ' + e.status)
      );
  }

  // return a new set of steps from the first to the last step closest to the halfway point
  const findLastStep = (halfWay, dir) => {
    // distance traveled by current steps
    let total = 0;
    let newSteps = [];
    for (let i = 0; i < dir.length; i++) {
      let step = dir[i];
      newSteps.push(step);
      total += step.distance.value;
      // compare the distance of processed steps to the halfway distance
      if (total > halfWay) {
        return newSteps;
        // TODO: dig into last step and find halfway point for accuracy
      }
    }
  };

  // generate a list of places within a certain radius based on a coordinate
  function findPlaces(lat, lng) {
    if (!map || (!lat && !lng)) {
      console.warn('Calculate the halfway point first.');
      return;
    }
    // clears near by places so we can calculate fresh places
    setNearByPlaces([]);

    // create PlacesService connected to our map
    const service = new window.google.maps.places.PlacesService(map);
    const { OK } = window.google.maps.places.PlacesServiceStatus;

    /*
      find places based on coordinates, radius and type of place
      takes search options and a call back function
    */ 
    service.nearbySearch(
      // search options
      { location: { lat, lng }, radius: 500, type: 'restaurant' },
      // callback
      (results, status) => {
        if (status !== OK || !results) {
          console.error('Nearby search failed:', status);
          return;
        }
        // loop over the near by places and get the google listing and website
        results.forEach((place) => {
          service.getDetails(
            { placeId: place.place_id, fields: ['url', 'website'] },
            (details, detailStatus) => {
              if (detailStatus !== OK) return;
              // add certain details from each new place to nearByPlaces
              setNearByPlaces((prev) => [
                ...prev,
                {
                  id: place.place_id,
                  name: place.name,
                  url: details.url,
                  website: details.website,
                  lat: place.geometry.location.lat(),
                  lng: place.geometry.location.lng(),
                },
              ]);
            }
          );
        });
      }
    );
  }

  // loops over the nearByPlaces state and renders a list of places with links to website and google listing
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
        {/* each place listing has the takeMeThere function */}
        <button onClick={() => takeMeThere(place)} style={{ margin: '8px' }}>
          Take Me There
        </button>
      </div>
    );
  });

    // this function is called using details of a place from the rendered list of suggested places
  function takeMeThere(place) {
  // clear markers from map
  hideMarkers();
  // route() returns a DirectionsResult object containing routes, legs, steps, distance etc..
  directionsService
    .route({
      origin: origin.geometry.location,
      destination: { placeId: place.id },
      travelMode: window.google.maps.TravelMode.WALKING,
    })
    .then((response) => {
      // which map to draw to
      directionsRender.setMap(map);
      // draws directions on map
      directionsRender.setDirections(response);
    })
    .catch((e) => window.alert('Directions request failed due to ' + e.status));
  }

  return (
    <div className="App">
      <div className="nav">
        <img src={logo} />
      </div>
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
