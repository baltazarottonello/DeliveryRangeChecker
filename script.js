import "./styles.css";
const LAST_STEP = 3;

const successText = "Estás dentro del rango!";
const failText = "Estás fuera del rango!";

//Nominatim query example
const baseUrl = "https://nominatim.openstreetmap.org/search?";

//form column DOM elements
const formContainer = document.querySelector(".form__column");

//store DOM elements
const formStoreAddress = document.querySelector(".form--store");
const inputCountryStore = document.querySelector(
  ".form__input--country--store"
);
const inputCityStore = document.querySelector(".form__input--city--store");
const inputCountyStore = document.querySelector(".form__input--county--store");
const inputStreetStore = document.querySelector(".form__input--street--store");
const inputNumberStore = document.querySelector(".form__input--number--store");
const inputPostalCodeStore = document.querySelector(
  ".form__input--postalcode--store"
);
//vertices DOM elements
const formVertices = document.querySelector(".form--vertices");
const formButtonDraw = document.querySelector(".form__button--drawrange");

//address DOM elements
const formAddress = document.querySelector(".form--address");
const inputCountry = document.querySelector(".form__input--country");
const inputCity = document.querySelector(".form__input--city");
const inputCounty = document.querySelector(".form__input--county");
const inputStreet = document.querySelector(".form__input--street");
const inputNumber = document.querySelector(".form__input--number");
const inputPostalCode = document.querySelector(".form__input--postalcode");
const formButtonVerify = document.querySelector(".form__button--verify");
const formButtonReset = document.querySelector(".form__button--reset");

//link DOM elements
const linkContainer = document.querySelector(".div__link-container");
const linkAnchor = document.querySelector(".a__link--delivery-range");

class App {
  #map;
  #storeMarker;
  #storeCoords;
  #verticesArray = [];
  #verticesCounter = 0;
  #rangePolygon;
  #step;
  #timeouts = [];

  constructor() {
    this._loadMap();

    if (location.search) {
      //set step 3
      this.#step = LAST_STEP;

      //get query params
      const queryParams = new URLSearchParams(location.search);

      const coords = this._formatParams(queryParams);

      this.#storeCoords = coords.storeCoords;
      this.#verticesArray = coords.polygonCoords;
    }
  }

  _loadMap() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;

          this.#map = L.map("map").setView([latitude, longitude], 16);
          L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution:
              '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          }).addTo(this.#map);

          if (this.#step === LAST_STEP) {
            L.marker(this.#storeCoords).addTo(this.#map);
            this._renderPolygon();
            this._setLastStep();
          } else {
            formStoreAddress.addEventListener(
              "submit",
              this._renderMarkerFromEvent.bind(this)
            );
            formVertices.addEventListener(
              "submit",
              this._renderPolygon.bind(this)
            );
          }
        },
        (e) => console.error(e)
      );
    }
  }

  async _renderMarkerFromEvent(event) {
    event.preventDefault();
    const eventFromStore = event.srcElement.classList[1].includes("store");
    let values;
    if (eventFromStore) {
      event["from"] = "store";
      const country = inputCountryStore.value;
      const city = inputCityStore.value;
      const county = inputCountyStore.value;
      const street = inputStreetStore.value;
      const number = inputNumberStore.value;
      const postalCode = inputPostalCodeStore.value;
      values = { country, city, county, street, number, postalCode };
    } else {
      const country = inputCountry.value;
      const city = inputCity.value;
      const county = inputCounty.value;
      const street = inputStreet.value;
      const number = inputNumber.value;
      const postalCode = inputPostalCode.value;

      values = {
        country,
        city,
        county,
        street,
        number,
        postalCode,
      };
    }

    const coords = await this._getCoords(values);

    if (coords.length < 1) {
      this._renderError(
        { message: "Direccion no encontrada" },
        formStoreAddress
      );
      return;
    }

    const marker = L.marker(coords).addTo(this.#map);

    //set view
    this.#map.setView(coords, 16);

    if (event.from === "store") {
      this.#storeCoords = coords;
      this.#storeMarker = marker;
      this._setStepTwo();
      return;
    }

    this._resetForm();

    return marker;
  }

  _resetForm() {
    formButtonVerify.disabled = true;
    formButtonReset.classList.remove("hidden");
    formButtonReset.addEventListener("click", (e) => {
      location.reload();
    });
  }

  _formatParams(queryParams) {
    try {
      //store coords
      const storeLatitude = parseFloat(queryParams.get("storelat"));
      const storeLongitude = parseFloat(queryParams.get("storelong"));

      //vertices coords
      const v1 = queryParams.get("v1").split(",");
      const v2 = queryParams.get("v2").split(",");
      const v3 = queryParams.get("v3").split(",");
      const v4 = queryParams.get("v4").split(",");
      const parsedV1Lat = parseFloat(v1[0]);
      const parsedV1Lon = parseFloat(v1[1]);
      const parsedV1 = [parsedV1Lat, parsedV1Lon];

      const parsedV2Lat = parseFloat(v2[0]);
      const parsedV2Lon = parseFloat(v2[1]);
      const parsedV2 = [parsedV2Lat, parsedV2Lon];

      const parsedV3Lat = parseFloat(v3[0]);
      const parsedV3Lon = parseFloat(v3[1]);
      const parsedV3 = [parsedV3Lat, parsedV3Lon];

      const parsedV4Lat = parseFloat(v4[0]);
      const parsedV4Lon = parseFloat(v4[1]);
      const parsedV4 = [parsedV4Lat, parsedV4Lon];

      return {
        polygonCoords: [parsedV1, parsedV2, parsedV3, parsedV4],
        storeCoords: [storeLatitude, storeLongitude],
      };
    } catch (e) {
      this._renderError({ message: "Ocurrio algo inesperado" });
    }
  }

  _setStepTwo() {
    //hide previous form
    formStoreAddress.classList.add("hidden");

    //render next step (user choose the vertices)
    formVertices.classList.remove("hidden");

    this.#map.on("click", this._loadVerticesArray.bind(this));
  }

  _setLastStep() {
    //hide previous form
    formStoreAddress.classList.add("hidden");
    //show last step form
    formAddress.classList.remove("hidden");

    formAddress.addEventListener("submit", this._checkRange.bind(this));
  }

  async _getCoords(values) {
    //fetch geocoding
    const { street, number, city, country, county, postalCode } = values;
    const response = await fetch(
      `${baseUrl}format=json&street=${street}%20${number}&city=${city}&country=${country}&county=${county}&postalcode=${postalCode}`
    );
    //extract coords
    const body = await response.json();

    if (body.length < 1) return [];

    const { lat, lon } = body[0];

    return [lat, lon];
  }

  async _checkRange(event) {
    const marker = await this._renderMarkerFromEvent(event);

    //check if inside
    const inside = this._isMarkerInsidePolygon(marker, this.#rangePolygon);
    if (inside) {
      formButtonVerify.innerText = successText;
      formButtonVerify.classList.remove("fail");
    } else {
      formButtonVerify.classList.add("fail");
      formButtonVerify.innerHTML = failText;
    }
  }

  _isMarkerInsidePolygon(marker, poly) {
    var polyPoints = poly.getLatLngs()[0];
    var x = marker.getLatLng().lat,
      y = marker.getLatLng().lng;

    var inside = false;
    for (var i = 0, j = polyPoints.length - 1; i < polyPoints.length; j = i++) {
      var xi = polyPoints[i].lat,
        yi = polyPoints[i].lng;
      var xj = polyPoints[j].lat,
        yj = polyPoints[j].lng;

      var intersect =
        yi > y != yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }

    return inside;
  }

  _loadVerticesArray(event) {
    //check if array is full
    if (this.#verticesArray.length === 4) {
      this.#map.clearAllEventListeners();
      return;
    }
    this.#verticesCounter++;
    const { lat, lng } = event.latlng;
    this.#verticesArray.push([lat, lng]);
    //render values
    this._renderVertexValue([lat, lng]);
  }

  _renderVertexValue(coords) {
    const inputField = document.querySelector(
      `.form__input--v${this.#verticesCounter}`
    );
    inputField.value = JSON.stringify(coords);
  }

  _renderPolygon(event) {
    if (this.#step === LAST_STEP) {
      this.#rangePolygon = L.polygon(this.#verticesArray).addTo(this.#map);
    } else {
      event.preventDefault();
      //check if step 1 is done
      if (!this.#storeMarker) {
        this._renderError(
          {
            message: "Primero tenes que marcar el local en el mapa!",
          },
          formButtonDraw
        );
        return;
      }

      //add polygon to map
      if (this.#verticesArray.length < 4) {
        return this._renderError(
          {
            message: "No seleccionaste todos los vertices",
          },
          formButtonDraw
        );
      }

      this.#rangePolygon = L.polygon(this.#verticesArray).addTo(this.#map);

      //make link with query params with info
      this._createLink();
    }
  }

  _createLink() {
    const link = `
    ${location.origin}/index.html?storelat=${this.#storeCoords[0]}&storelong=${
      this.#storeCoords[1]
    }&v1=${this.#verticesArray[0]}&v2=${this.#verticesArray[1]}&v3=${
      this.#verticesArray[2]
    }&v4=${this.#verticesArray[3]}`;

    //render link
    this._renderLink(link);
  }

  _renderLink(link) {
    linkContainer.classList.remove("hidden");
    linkAnchor.href = link;
    linkAnchor.target = "_blank";

    //hide vertices form
    formVertices.classList.add("hidden");
    formContainer.classList.add("completed");
  }

  _renderError(error, element) {
    const errorDiv = document.querySelector(".div__error");
    const errorMsg = document.querySelector(".p__error-message");
    errorDiv.classList.remove("hidden");
    errorMsg.textContent = error.message;
    if (element) {
      let cleared;
      let timeoutObj = this.#timeouts.find(
        (timeout) => timeout.element === element
      );
      if (timeoutObj) {
        cleared = true;
        clearTimeout(timeoutObj.timeout);
        this.#timeouts = this.#timeouts.filter(
          (timeout) => timeout !== timeoutObj
        );
      }
      element.classList.add("disabled");
      const timeout = setTimeout(() => {
        errorDiv.classList.add("hidden");
        element.classList.remove("disabled");
      }, 1000);
      if (cleared) this.#timeouts.push({ element, timeout });
    }
  }
}

const app = new App();
