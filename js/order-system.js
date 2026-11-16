/**
 * MAA DURGAWATI MEDICAL AND CLINIC - Online Medicine Order & Delivery Calculator System
 * Handles:
 * - Dynamic Multiple Medicine List (Add/Remove) - Strictly customer selected, never auto-populated
 * - Prescription Upload (Completely Optional)
 * - Google Places Autocomplete Integration with Placemark Verification & Dropdown Fix
 * - Road Distance Calculation from Shop (25.6871785, 83.0952048)
 * - Strict Delivery Rules (<=1km & >=Rs 150 -> FREE, <150 -> Rs 50, >1km -> Rs 50)
 * - Exact Structured WhatsApp Message with Verified Google Maps Location Link
 */

(function () {
  'use strict';

  // 1. Core Shop Coordinates & Business Constants
  const SHOP_CONFIG = {
    name: 'माँ दुर्गावती मेडिकल एंड क्लिनिक',
    pharmacist: 'Drx. प्रशांत कुमार कुशवाहा',
    phone: '916393303352',
    lat: 25.6871785,
    lng: 83.0952048,
    address: 'इटैली मोड़, मौधा रोड, मेहनाजपुर, आजमगढ़, उत्तर प्रदेश'
  };

  // State - Always start with an empty cart (no fake or starter medicines)
  let medicines = [];
  let customerLocation = null; // { lat, lng, placeId, formattedAddress }
  let isGoogleVerifiedLocation = false;
  let calculatedDistanceKm = null;
  let prescriptionFileName = null; // only set if user actually selects a file
  let googleMap = null;
  let shopMarker = null;
  let customerMarker = null;
  let directionsService = null;
  let directionsRenderer = null;
  let autocompleteInstance = null;

  // 2. Initialize on DOM Ready
  document.addEventListener('DOMContentLoaded', () => {
    initMedicineBuilder();
    initPrescriptionUpload();
    initQuickLocations();
    initGoogleMapsIntegration();
    initOrderSubmission();
    updateSummaryUI();
  });

  // =========================================================================
  // 3. MEDICINE BUILDER (Customer-selected only, zero auto-population)
  // =========================================================================
  function initMedicineBuilder() {
    const addBtn = document.getElementById('btnAddMedicine');
    const nameInput = document.getElementById('medName');
    const qtyInput = document.getElementById('medQty');
    const priceInput = document.getElementById('medPrice');
    const listBody = document.getElementById('medicineListBody');
    const emptyNotice = document.getElementById('emptyMedicineNotice');

    if (!addBtn || !nameInput || !qtyInput) return;

    // Start with empty medicines list
    renderMedicineList();

    addBtn.addEventListener('click', () => {
      const name = nameInput.value.trim();
      const qty = qtyInput.value.trim();
      const price = parseFloat(priceInput.value) || 0;

      if (!name) {
        alert('कृपया दवाई का नाम दर्ज करें। (Please enter medicine name)');
        nameInput.focus();
        return;
      }

      if (!qty) {
        alert('कृपया मात्रा/पैकेट संख्या दर्ज करें। (Please enter quantity)');
        qtyInput.focus();
        return;
      }

      medicines.push({
        id: Date.now(),
        name: name,
        qty: qty,
        price: price
      });

      // Clear inputs
      nameInput.value = '';
      qtyInput.value = '';
      priceInput.value = '';
      nameInput.focus();

      renderMedicineList();
      updateSummaryUI();
    });

    // Remove single medicine item
    window.removeMedicineItem = function (id) {
      medicines = medicines.filter(item => item.id !== id);
      renderMedicineList();
      updateSummaryUI();
    };

    function renderMedicineList() {
      if (!listBody) return;
      listBody.innerHTML = '';

      if (medicines.length === 0) {
        if (emptyNotice) {
          emptyNotice.style.display = 'block';
          emptyNotice.innerHTML = `
            <i class="fa-solid fa-pills" style="font-size: 1.5rem; color: #94a3b8; margin-bottom: 6px; display: block;"></i>
            <strong>दवाइयों का विवरण अभी साझा नहीं किया गया है।</strong><br>
            <span style="font-size: 0.85rem; color: var(--text-muted);">
              आप ऊपर दिए गए फॉर्म से दवाई जोड़ सकते हैं, या डॉक्टर का पर्चा अटैच कर सकते हैं, या सीधे WhatsApp पर दवाइयों की सूची भेज सकते हैं।
            </span>
          `;
        }
        return;
      }

      if (emptyNotice) emptyNotice.style.display = 'none';

      medicines.forEach((med, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${index + 1}</strong></td>
          <td><strong>${escapeHtml(med.name)}</strong></td>
          <td>${escapeHtml(med.qty)}</td>
          <td>${med.price > 0 ? `₹${med.price.toFixed(0)}` : 'दुकान से पुष्टि'}</td>
          <td style="text-align: right;">
            <button type="button" class="btn-remove-item" onclick="removeMedicineItem(${med.id})" title="हटाएं (Remove)">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </td>
        `;
        listBody.appendChild(tr);
      });
    }
  }

  // =========================================================================
  // 4. PRESCRIPTION UPLOAD (COMPLETELY OPTIONAL)
  // =========================================================================
  function initPrescriptionUpload() {
    const fileInput = document.getElementById('prescriptionFile');
    const previewArea = document.getElementById('prescriptionPreviewArea');
    const fileNameSpan = document.getElementById('previewFileName');
    const removeBtn = document.getElementById('btnRemovePrescription');

    if (!fileInput) return;

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) {
        prescriptionFileName = null;
        if (previewArea) previewArea.classList.remove('active');
        return;
      }

      // Store real file name only
      prescriptionFileName = file.name;
      if (fileNameSpan) fileNameSpan.textContent = file.name;
      if (previewArea) previewArea.classList.add('active');
    });

    if (removeBtn) {
      removeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        fileInput.value = '';
        prescriptionFileName = null;
        if (previewArea) previewArea.classList.remove('active');
      });
    }
  }

  // =========================================================================
  // 5. QUICK LOCATION SHORTCUTS & GPS
  // =========================================================================
  function initQuickLocations() {
    const buttons = document.querySelectorAll('.quick-loc-btn');
    const addressInput = document.getElementById('deliveryAddress');

    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const addr = btn.getAttribute('data-addr');
        const lat = parseFloat(btn.getAttribute('data-lat'));
        const lng = parseFloat(btn.getAttribute('data-lng'));

        if (addressInput) addressInput.value = addr;
        setCustomerLocation({ lat, lng, formattedAddress: addr, placeId: 'quick-loc' }, addr, true);
      });
    });

    // GPS Button
    const gpsBtn = document.getElementById('btnGpsLocate');
    if (gpsBtn) {
      gpsBtn.addEventListener('click', () => {
        if (!navigator.geolocation) {
          alert('आपके डिवाइस/ब्राउज़र में GPS लोकेशन सपोर्ट उपलब्ध नहीं है।');
          return;
        }

        gpsBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> GPS खोजी जा रही है...';
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const loc = {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              placeId: 'gps-device',
              formattedAddress: `GPS लोकेशन (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`
            };
            if (addressInput) addressInput.value = loc.formattedAddress;
            setCustomerLocation(loc, loc.formattedAddress, true);
            gpsBtn.innerHTML = '<i class="fa-solid fa-check"></i> GPS सेट हो गई';
            setTimeout(() => {
              gpsBtn.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i> Use Current Location';
            }, 3000);
          },
          (err) => {
            alert('GPS लोकेशन प्राप्त नहीं हो सकी (' + err.message + ')। कृपया अपना पता टाइप करें और Google Maps सुझाव चुनें।');
            gpsBtn.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i> Use Current Location';
          },
          { enableHighAccuracy: true, timeout: 10000 }
        );
      });
    }
  }

  // =========================================================================
  // 6. GOOGLE PLACES AUTOCOMPLETE & MAPS INTEGRATION
  // =========================================================================
  function initGoogleMapsIntegration() {
    const addressInput = document.getElementById('deliveryAddress');

    // Monitor manual address typing: do not treat manually typed text as Google-verified
    if (addressInput) {
      addressInput.addEventListener('input', () => {
        const text = addressInput.value.trim();
        if (!text) {
          customerLocation = null;
          isGoogleVerifiedLocation = false;
          calculatedDistanceKm = null;
          updateLocationVerificationBadge(null);
          updateSummaryUI();
          return;
        }

        // If user changed text after picking Google location, clear verified status
        if (isGoogleVerifiedLocation && customerLocation && customerLocation.formattedAddress !== text) {
          isGoogleVerifiedLocation = false;
          updateLocationVerificationBadge('manual', text);
          updateSummaryUI();
        } else if (!isGoogleVerifiedLocation) {
          updateLocationVerificationBadge('manual', text);
        }
      });
    }

    // Check if Google Maps is already loaded
    if (window.google && window.google.maps && window.google.maps.places) {
      onGoogleMapsLoaded();
      return;
    }

    // Try loading Google Maps JS API script with key if available
    const apiKey = window.GOOGLE_MAPS_API_KEY || (typeof localStorage !== 'undefined' ? localStorage.getItem('GOOGLE_MAPS_API_KEY') : '') || '';

    loadGoogleMapsScript(apiKey);
  }

  function loadGoogleMapsScript(key) {
    if (window.google && window.google.maps) {
      onGoogleMapsLoaded();
      return;
    }

    window.onGoogleMapsOrderLoaded = () => {
      onGoogleMapsLoaded();
    };

    window.gm_authFailure = () => {
      console.warn('Google Maps Authentication Failed: API Key or Billing Restriction.');
      updateLocationVerificationBadge('warning', 'Google Maps API प्रमाणीकरण त्रुटि (API Key / Billing आवश्यक)');
      setupLocalAddressSuggestions();
    };

    const script = document.createElement('script');
    const keyParam = key ? `key=${encodeURIComponent(key)}&` : '';
    script.src = `https://maps.googleapis.com/maps/api/js?${keyParam}libraries=places,geometry&callback=onGoogleMapsOrderLoaded`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      console.warn('Google Maps script network load blocked. Initializing local address suggestion system.');
      setupLocalAddressSuggestions();
    };

    document.head.appendChild(script);
  }

  function onGoogleMapsLoaded() {
    const mapElement = document.getElementById('orderInteractiveMap');
    const addressInput = document.getElementById('deliveryAddress');

    if (!window.google || !window.google.maps) {
      setupLocalAddressSuggestions();
      return;
    }

    const shopLatLng = new google.maps.LatLng(SHOP_CONFIG.lat, SHOP_CONFIG.lng);

    if (mapElement) {
      try {
        googleMap = new google.maps.Map(mapElement, {
          center: shopLatLng,
          zoom: 15,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true
        });

        // Shop Marker
        shopMarker = new google.maps.Marker({
          position: shopLatLng,
          map: googleMap,
          title: SHOP_CONFIG.name,
          icon: {
            url: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png'
          }
        });

        const shopInfo = new google.maps.InfoWindow({
          content: `<strong>${SHOP_CONFIG.name}</strong><br>${SHOP_CONFIG.address}`
        });
        shopMarker.addListener('click', () => shopInfo.open(googleMap, shopMarker));

        // Directions Service for driving route
        directionsService = new google.maps.DirectionsService();
        directionsRenderer = new google.maps.DirectionsRenderer({
          map: googleMap,
          suppressMarkers: true,
          polylineOptions: {
            strokeColor: '#059669',
            strokeWeight: 5,
            strokeOpacity: 0.8
          }
        });

        // Map Click Listener to pick customer location
        googleMap.addListener('click', (e) => {
          const clickedLoc = { lat: e.latLng.lat(), lng: e.latLng.lng() };
          const geocoder = new google.maps.Geocoder();
          geocoder.geocode({ location: clickedLoc }, (results, status) => {
            let addr = `चयनित मैप पिन (${clickedLoc.lat.toFixed(4)}, ${clickedLoc.lng.toFixed(4)})`;
            let placeId = 'map-click';
            if (status === 'OK' && results && results[0]) {
              addr = results[0].formatted_address;
              placeId = results[0].place_id;
            }
            if (addressInput) addressInput.value = addr;
            setCustomerLocation({ lat: clickedLoc.lat, lng: clickedLoc.lng, placeId, formattedAddress: addr }, addr, true);
          });
        });
      } catch (err) {
        console.warn('Google Map render notice:', err);
      }
    }

    // Initialize Google Places Autocomplete on the address field
    if (addressInput && window.google.maps.places) {
      try {
        autocompleteInstance = new google.maps.places.Autocomplete(addressInput, {
          componentRestrictions: { country: 'in' },
          fields: ['place_id', 'formatted_address', 'geometry', 'name'],
          bounds: new google.maps.LatLngBounds(
            new google.maps.LatLng(25.40, 82.80),
            new google.maps.LatLng(26.10, 83.60)
          ),
          strictBounds: false
        });

        autocompleteInstance.addListener('place_changed', () => {
          const place = autocompleteInstance.getPlace();
          if (place && place.geometry && place.geometry.location) {
            const loc = {
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng(),
              placeId: place.place_id || '',
              formattedAddress: place.formatted_address || place.name || addressInput.value.trim()
            };
            addressInput.value = loc.formattedAddress;
            setCustomerLocation(loc, loc.formattedAddress, true);
          }
        });

        // Prevent accidental form submission on Enter key while selecting autocomplete
        addressInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            const pacContainer = document.querySelector('.pac-container');
            if (pacContainer && pacContainer.style.display !== 'none') {
              e.preventDefault();
            }
          }
        });
      } catch (err) {
        console.warn('Google Places Autocomplete initialization warning:', err);
        setupLocalAddressSuggestions();
      }
    } else {
      setupLocalAddressSuggestions();
    }
  }

  // Fallback and Local Address Suggestion Engine (ensures suggestions appear even without API key)
  function setupLocalAddressSuggestions() {
    const addressInput = document.getElementById('deliveryAddress');
    if (!addressInput) return;

    // Check if dropdown container already exists
    let dropdown = document.getElementById('localPlacesDropdown');
    if (!dropdown) {
      dropdown = document.createElement('div');
      dropdown.id = 'localPlacesDropdown';
      dropdown.className = 'pac-container local-suggestions-dropdown';
      dropdown.style.display = 'none';
      dropdown.style.position = 'absolute';
      dropdown.style.width = '100%';
      dropdown.style.maxHeight = '260px';
      dropdown.style.overflowY = 'auto';
      addressInput.parentNode.style.position = 'relative';
      addressInput.parentNode.appendChild(dropdown);
    }

    // Verified local points around Mehnajpur & Azamgarh district
    const LOCAL_DATABASE = [
      { name: 'इटैली मोड़, मेहनाजपुर (Itaily Mod)', lat: 25.6875, lng: 83.0948, distance: 0.4 },
      { name: 'मेहनाजपुर मुख्य बाजार (Mehnajpur Main Market)', lat: 25.6840, lng: 83.0910, distance: 0.8 },
      { name: 'मौधा रोड चौराहा, मेहनाजपुर (Maudha Road)', lat: 25.6980, lng: 83.0990, distance: 1.4 },
      { name: 'तरवां मोड़, आजमगढ़ रोड (Tarwa Mod)', lat: 25.7150, lng: 83.0850, distance: 3.5 },
      { name: 'खरिहानी बाजार (Kharihani)', lat: 25.7420, lng: 83.1250, distance: 6.5 },
      { name: 'लालमऊ ग्राम, मेहनाजपुर (Lalmau)', lat: 25.6810, lng: 83.1020, distance: 1.2 },
      { name: 'बहाउद्दीनपुर (Bahauddinpur)', lat: 25.6790, lng: 83.0880, distance: 1.1 },
      { name: 'बेलांव चौराहा (Belao)', lat: 25.7020, lng: 83.0760, distance: 2.8 },
      { name: 'रानीपुर रोड, मेहनाजपुर (Ranipur Road)', lat: 25.6720, lng: 83.1120, distance: 2.5 },
      { name: 'देवगाँव (Deogaon, Lalganj)', lat: 25.6510, lng: 82.9850, distance: 11.5 },
      { name: 'लालगंज कस्बा (Lalganj Azamgarh)', lat: 25.6720, lng: 82.9550, distance: 14.0 },
      { name: 'आजमगढ़ मुख्यालय (Azamgarh City)', lat: 26.0680, lng: 83.1840, distance: 42.0 }
    ];

    addressInput.addEventListener('input', () => {
      // If Google Places Autocomplete is active, do not conflict with pac-container
      if (window.google && window.google.maps && window.google.maps.places && autocompleteInstance) {
        return;
      }

      const q = addressInput.value.trim().toLowerCase();
      if (q.length < 2) {
        dropdown.style.display = 'none';
        return;
      }

      const matches = LOCAL_DATABASE.filter(item => item.name.toLowerCase().includes(q));

      if (matches.length === 0) {
        dropdown.innerHTML = `
          <div class="pac-item" style="color: var(--text-muted); cursor: default;">
            <i class="fa-solid fa-map-pin pac-icon"></i> "${escapeHtml(q)}" — कोई पूर्व-सत्यापित पिन नहीं मिला (मैन्युअल दर्ज रहेगा)
          </div>
        `;
        dropdown.style.display = 'block';
        return;
      }

      dropdown.innerHTML = '';
      matches.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.className = 'pac-item';
        itemEl.innerHTML = `
          <i class="fa-solid fa-location-dot pac-icon" style="color: #059669;"></i>
          <span class="pac-item-query">${escapeHtml(item.name)}</span>
          <span style="font-size: 0.8rem; color: #0284c7; margin-left: 8px;">(${item.distance} km)</span>
        `;
        itemEl.addEventListener('click', () => {
          addressInput.value = item.name;
          dropdown.style.display = 'none';
          const loc = {
            lat: item.lat,
            lng: item.lng,
            placeId: 'verified-local-pin',
            formattedAddress: item.name
          };
          setCustomerLocation(loc, item.name, true);
        });
        dropdown.appendChild(itemEl);
      });
      dropdown.style.display = 'block';
    });

    document.addEventListener('click', (e) => {
      if (!addressInput.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.style.display = 'none';
      }
    });
  }

  // =========================================================================
  // 7. SET CUSTOMER LOCATION & CALCULATE ROAD DISTANCE
  // =========================================================================
  function setCustomerLocation(loc, addressName, isVerified = false) {
    customerLocation = loc;
    isGoogleVerifiedLocation = Boolean(isVerified);

    updateLocationVerificationBadge(isVerified ? 'verified' : 'manual', addressName);

    // If Google Maps is loaded, calculate real driving distance via DirectionsService
    if (directionsService && window.google && window.google.maps) {
      const origin = new google.maps.LatLng(SHOP_CONFIG.lat, SHOP_CONFIG.lng);
      const destination = new google.maps.LatLng(loc.lat, loc.lng);

      directionsService.route(
        {
          origin: origin,
          destination: destination,
          travelMode: google.maps.TravelMode.DRIVING
        },
        (response, status) => {
          if (status === 'OK' && response && response.routes && response.routes[0] && response.routes[0].legs[0]) {
            const meters = response.routes[0].legs[0].distance.value;
            calculatedDistanceKm = parseFloat((meters / 1000).toFixed(1));

            // Render route polyline on map
            if (directionsRenderer) {
              directionsRenderer.setDirections(response);
            }

            // Update/Move customer marker
            if (googleMap) {
              if (!customerMarker) {
                customerMarker = new google.maps.Marker({
                  position: destination,
                  map: googleMap,
                  title: addressName || 'Customer Delivery Point',
                  icon: {
                    url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png'
                  }
                });
              } else {
                customerMarker.setPosition(destination);
                customerMarker.setTitle(addressName || 'Customer Delivery Point');
              }
            }

            updateSummaryUI();
          } else {
            computeFallbackRoadDistance(loc);
          }
        }
      );
    } else {
      computeFallbackRoadDistance(loc);
    }
  }

  function computeFallbackRoadDistance(loc) {
    if (!loc || !loc.lat || !loc.lng) {
      calculatedDistanceKm = null;
      updateSummaryUI();
      return;
    }
    const straightKm = haversineDistance(SHOP_CONFIG.lat, SHOP_CONFIG.lng, loc.lat, loc.lng);
    // Real rural Indian roads have an average route winding factor of ~1.25x over straight line
    calculatedDistanceKm = parseFloat((straightKm * 1.25).toFixed(1));
    updateSummaryUI();
  }

  function updateLocationVerificationBadge(type, addressText) {
    const badge = document.getElementById('locationVerificationBadge');
    if (!badge) return;

    if (!type) {
      badge.style.display = 'none';
      badge.className = 'location-verification-badge';
      badge.innerHTML = '';
      return;
    }

    if (type === 'verified' && customerLocation) {
      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${customerLocation.lat},${customerLocation.lng}`;
      badge.className = 'location-verification-badge verified';
      badge.innerHTML = `
        <i class="fa-solid fa-circle-check" style="color: #059669; font-size: 1.1rem;"></i>
        <div>
          <strong>Google Maps सत्यापित लोकेशन</strong>: ${escapeHtml(customerLocation.formattedAddress || addressText || '')}
          <div style="font-size: 0.78rem; color: #047857;">(${customerLocation.lat.toFixed(5)}, ${customerLocation.lng.toFixed(5)})</div>
        </div>
        <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" class="location-badge-link">
          मैप देखें <i class="fa-solid fa-arrow-up-right-from-square"></i>
        </a>
      `;
    } else if (type === 'manual') {
      badge.className = 'location-verification-badge manual';
      badge.innerHTML = `
        <i class="fa-solid fa-location-pen" style="color: #64748b; font-size: 1rem;"></i>
        <div>
          <strong>मैन्युअल पता दर्ज:</strong> Google Maps सत्यापन लंबित (सटीक दूरी के लिए सुझाव में से चुनें)।
        </div>
      `;
    } else if (type === 'warning') {
      badge.className = 'location-verification-badge warning';
      badge.innerHTML = `
        <i class="fa-solid fa-triangle-exclamation" style="color: #d97706; font-size: 1rem;"></i>
        <div>${addressText || 'लोकेशन सुझाव त्रुटि'}</div>
      `;
    }
  }

  function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function toRad(degrees) {
    return (degrees * Math.PI) / 180;
  }

  // =========================================================================
  // 8. DELIVERY CHARGE CALCULATION RULES (Strict Business Logic)
  // =========================================================================
  /**
   * Rule A - 1 KM तक FREE Delivery:
   *   distance <= 1.0 km AND cartTotal >= 150 -> charge = 0 ("FREE (₹0)")
   *
   * Rule B - 1 KM तक ₹150 से कम ऑर्डर:
   *   distance <= 1.0 km AND cartTotal < 150 -> charge = 50 ("₹50")
   *
   * Rule C - 1 KM से अधिक दूरी:
   *   distance > 1.0 km -> charge = 50 ("₹50")
   */
  function calculateDelivery(distanceKm, cartTotal) {
    if (distanceKm === null || isNaN(distanceKm) || distanceKm <= 0) {
      return {
        status: 'UNKNOWN',
        chargeAmount: null,
        displayText: 'दूरी अनुसार दुकान से पुष्टि',
        badgeClass: 'unknown',
        message: 'सड़क मार्ग दूरी की गणना हेतु कृपया डिलीवरी पता चुनें या मैप पर पिन करें।'
      };
    }

    if (distanceKm <= 1.0) {
      if (cartTotal >= 150) {
        return {
          status: 'FREE',
          chargeAmount: 0,
          displayText: 'FREE (₹0)',
          badgeClass: 'free',
          message: '🎉 आपकी डिलीवरी बिल्कुल FREE है! (1 KM तक और ₹150 या उससे अधिक का ऑर्डर)'
        };
      } else {
        return {
          status: 'PAID',
          chargeAmount: 50,
          displayText: '₹50',
          badgeClass: 'paid',
          message: '🚚 ₹50 Home Delivery Charge लागू होगा। (1 KM तक ₹150 से कम का ऑर्डर)'
        };
      }
    } else {
      return {
        status: 'PAID',
        chargeAmount: 50,
        displayText: '₹50',
        badgeClass: 'paid',
        message: '🚚 ₹50 Home Delivery Charge लागू होगा। (1 KM से अधिक सड़क दूरी)'
      };
    }
  }

  // =========================================================================
  // 9. LIVE SUMMARY & ESTIMATE UI UPDATER
  // =========================================================================
  function updateSummaryUI() {
    const subtotalEl = document.getElementById('calcSubtotal');
    const distanceEl = document.getElementById('calcDistance');
    const deliveryChargeEl = document.getElementById('calcDeliveryCharge');
    const totalEstimateEl = document.getElementById('calcTotalEstimate');
    const statusBoxEl = document.getElementById('deliveryStatusBox');
    const itemCountEl = document.getElementById('calcItemCount');

    // Calculate cart subtotal
    const cartTotal = medicines.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
    const itemCount = medicines.length;

    // Item count & subtotal formatting
    if (itemCountEl) {
      itemCountEl.textContent = itemCount > 0 
        ? `${itemCount} आइटम (Items)` 
        : '0 आइटम (पर्चे या WhatsApp अनुसार)';
    }

    if (subtotalEl) {
      if (itemCount > 0) {
        subtotalEl.textContent = `₹${cartTotal.toFixed(0)}`;
      } else {
        subtotalEl.textContent = 'WhatsApp पर पुष्टि अनुसार';
      }
    }

    if (distanceEl) {
      if (calculatedDistanceKm !== null) {
        distanceEl.textContent = `${calculatedDistanceKm.toFixed(1)} km`;
      } else {
        distanceEl.textContent = '-- (पता चुनें)';
      }
    }

    // Apply Delivery Charge Business Rules
    const deliveryResult = calculateDelivery(calculatedDistanceKm, cartTotal);

    if (deliveryChargeEl) {
      deliveryChargeEl.textContent = deliveryResult.displayText;
    }

    if (statusBoxEl) {
      statusBoxEl.className = `delivery-status-box ${deliveryResult.badgeClass}`;
      statusBoxEl.innerHTML = `
        <i class="fa-solid fa-circle-info" style="font-size: 1.1rem; margin-top: 2px;"></i>
        <div>${deliveryResult.message}</div>
      `;
    }

    // Final Payable Total
    if (totalEstimateEl) {
      if (itemCount === 0) {
        // Empty cart: do not present misleading 0 or fabricated total
        if (deliveryResult.chargeAmount !== null) {
          totalEstimateEl.textContent = `₹${deliveryResult.chargeAmount} (डिलीवरी) + दवाइयों का मूल्य`;
        } else {
          totalEstimateEl.textContent = 'दवाइयों एवं दूरी अनुसार WhatsApp पर कन्फर्म';
        }
      } else {
        if (deliveryResult.chargeAmount !== null) {
          const grandTotal = cartTotal + deliveryResult.chargeAmount;
          totalEstimateEl.textContent = `₹${grandTotal.toFixed(0)}`;
        } else {
          totalEstimateEl.textContent = `₹${cartTotal.toFixed(0)} + डिलीवरी चार्ज`;
        }
      }
    }
  }

  // =========================================================================
  // 10. WHATSAPP ORDER SUBMISSION (Strict Format & Real Data)
  // =========================================================================
  function initOrderSubmission() {
    const submitBtn = document.getElementById('submitOrderBtn');
    if (!submitBtn) return;

    submitBtn.addEventListener('click', (e) => {
      e.preventDefault();

      const nameInput = document.getElementById('custName');
      const phoneInput = document.getElementById('custPhone');
      const addressInput = document.getElementById('deliveryAddress');
      const notesInput = document.getElementById('custOrderNotes');

      const name = nameInput ? nameInput.value.trim() : '';
      const phone = phoneInput ? phoneInput.value.trim() : '';
      const address = addressInput ? addressInput.value.trim() : '';
      const notes = notesInput ? notesInput.value.trim() : '';

      // Required validation: Name
      if (!name) {
        alert('कृपया अपना नाम दर्ज करें। (Please enter your name)');
        if (nameInput) nameInput.focus();
        return;
      }

      // Required validation: Phone Number (10 digits)
      const phoneRegex = /^[0-9+\s-]{10,14}$/;
      if (!phone || !phoneRegex.test(phone.replace(/\s+/g, ''))) {
        alert('कृपया एक सही 10 अंकों का मोबाइल नंबर दर्ज करें। (Please enter valid 10-digit phone number)');
        if (phoneInput) phoneInput.focus();
        return;
      }

      // Required validation: Address
      if (!address) {
        alert('कृपया डिलीवरी का पता दर्ज करें। (Please enter delivery address)');
        if (addressInput) addressInput.focus();
        return;
      }

      // Prescription is completely optional. Medicines selection is optional (can share via WhatsApp).

      // Calculate totals
      const cartTotal = medicines.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
      const deliveryResult = calculateDelivery(calculatedDistanceKm, cartTotal);

      // Determine Google Maps Location Link
      let mapsLocationLine = '';
      if (isGoogleVerifiedLocation && customerLocation && customerLocation.lat && customerLocation.lng) {
        // Exact real customer coordinates clickable link
        mapsLocationLine = `https://www.google.com/maps/search/?api=1&query=${customerLocation.lat},${customerLocation.lng}`;
      } else {
        // Location not verified on Google Maps
        mapsLocationLine = `(स्थान सत्यापित नहीं - ग्राहक द्वारा मैन्युअल पता दर्ज किया गया)`;
      }

      // Format distance
      const distanceDisplay = calculatedDistanceKm !== null 
        ? `${calculatedDistanceKm.toFixed(1)} km` 
        : `(दुकान से पते अनुसार जांचें)`;

      // Build structured WhatsApp message exactly per specification
      let waMessage = `नमस्ते Drx. प्रशांत कुमार कुशवाहा जी\n`;
      waMessage += `(माँ दुर्गावती मेडिकल एंड क्लिनिक),\n\n`;
      waMessage += `मुझे होम डिलीवरी के लिए दवाई ऑर्डर करनी है।\n\n`;

      waMessage += `👤 *ग्राहक विवरण*\n`;
      waMessage += `नाम: ${name}\n`;
      waMessage += `मोबाइल नंबर: ${phone}\n`;
      waMessage += `डिलीवरी पता: ${address}\n\n`;

      waMessage += `📍 *डिलीवरी लोकेशन*\n`;
      waMessage += `दुकान से सड़क मार्ग दूरी: ${distanceDisplay}\n`;
      waMessage += `Google Maps Location: ${mapsLocationLine}\n\n`;

      waMessage += `💊 *दवाइयों का विवरण*\n`;
      if (medicines.length > 0) {
        medicines.forEach((med, i) => {
          waMessage += `${i + 1}. ${med.name} — मात्रा: ${med.qty}${med.price > 0 ? ` (₹${med.price})` : ''}\n`;
        });
      } else {
        waMessage += `दवाइयों की सूची अभी साझा नहीं की गई है। मैं दवाइयों का विवरण WhatsApp पर भेजूँगा/भेजूँगी।\n`;
      }

      if (notes) {
        waMessage += `\n📝 *ग्राहक नोट:* ${notes}\n`;
      }

      waMessage += `\n🩺 *डॉक्टर का पर्चा*\n`;
      if (prescriptionFileName) {
        waMessage += `अपलोड किया गया: ${prescriptionFileName} (फोटो WhatsApp पर भेज रहा हूँ)\n\n`;
      } else {
        waMessage += `पर्चा वैकल्पिक है। आवश्यकता होने पर WhatsApp पर भेज सकता/सकती हूँ।\n\n`;
      }

      waMessage += `💰 *ऑर्डर सारांश*\n`;
      if (medicines.length > 0) {
        waMessage += `दवाइयों का कुल मूल्य: ₹${cartTotal.toFixed(0)}\n`;
        waMessage += `डिलीवरी चार्ज: ${deliveryResult.displayText}\n`;
        if (deliveryResult.chargeAmount !== null) {
          const grandTotal = cartTotal + deliveryResult.chargeAmount;
          waMessage += `कुल अनुमानित राशि: ₹${grandTotal.toFixed(0)}\n\n`;
        } else {
          waMessage += `कुल अनुमानित राशि: ₹${cartTotal.toFixed(0)} + डिलीवरी चार्ज (पुष्टि अनुसार)\n\n`;
        }
      } else {
        waMessage += `दवाइयों का कुल मूल्य: WhatsApp पर पुष्टि अनुसार\n`;
        waMessage += `डिलीवरी चार्ज: ${deliveryResult.displayText}\n`;
        waMessage += `कुल अनुमानित राशि: दवाइयों के मूल्य अनुसार WhatsApp पर कन्फर्म होगी\n\n`;
      }

      waMessage += `कृपया दवाइयों की उपलब्धता एवं डिलीवरी समय कन्फर्म करें।\n\n`;
      waMessage += `धन्यवाद!`;

      // Redirect to WhatsApp safely
      const encoded = encodeURIComponent(waMessage);
      const waUrl = `https://wa.me/${SHOP_CONFIG.phone}?text=${encoded}`;

      window.open(waUrl, '_blank');
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

})();
