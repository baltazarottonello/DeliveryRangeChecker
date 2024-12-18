import "./styles.css";

class App {
  #domElements;
  #map;
  #storeMarker;
  #storeCoords;
  #addressMarker;
  #verticesArray = [];
  #verticesCounter = 0;
  #rangePolygon;
  #step;
  #timeouts = [];
  #fieldsChanged;
  #lastStep = 3;
  #successText = "Estás dentro del rango!";
  #failText = "Estás fuera del rango!";
  #apiBaseUrl = "https://nominatim.openstreetmap.org/search?";

  constructor() {
    this._createDomMap();

    this._loadMap();

    if (location.search) {
      //set step 3
      this.#step = this.#lastStep;

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

          if (this.#step === this.#lastStep) {
            this.#domElements
              .get("button__reset")
              .addEventListener("click", this._reset.bind(this));
            L.marker(this.#storeCoords).addTo(this.#map);
            this._renderPolygon();
            this._setLastStep();
          } else {
            this.#domElements
              .get("form__store")
              .addEventListener(
                "submit",
                this._renderMarkerFromEvent.bind(this)
              );
            this.#domElements
              .get("form__vertices")
              .addEventListener("submit", this._renderPolygon.bind(this));
          }
        },
        (e) => console.error(e)
      );
    }
  }

  _createDomMap() {
    this.#domElements = new Map();
    const allElements = document.querySelectorAll("*");
    for (const element of allElements) {
      this.#domElements.set(element.classList[1], element);
    }
  }

  async _renderMarkerFromEvent(event) {
    event.preventDefault();
    const eventFromStore = event.srcElement.classList[1].includes("store");
    let values;
    if (eventFromStore) {
      event["from"] = "store";
      const country = this.#domElements.get("input__country--store").value;
      const city = this.#domElements.get("input__city--store").value;
      const county = this.#domElements.get("input__county--store").value;
      const street = this.#domElements.get("input__street--store").value;
      const number = this.#domElements.get("input__number--store").value;
      const postalCode = this.#domElements.get(
        "input__postalcode--store"
      ).value;
      values = { country, city, county, street, number, postalCode };
    } else {
      const country = this.#domElements.get("input__country").value;
      const city = this.#domElements.get("input__city").value;
      const county = this.#domElements.get("input__county").value;
      const street = this.#domElements.get("input__street").value;
      const number = this.#domElements.get("input__number").value;
      const postalCode = this.#domElements.get("input__postalcode").value;

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
        this.#domElements.get("form__store")
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

    this.#addressMarker = marker;

    this.#domElements.get("button__reset").classList.remove("hidden");
    this.#domElements.get("button__verify").disabled = true;
    const fieldsInput = this.#domElements
      .get("form__address")
      .querySelectorAll("input");
    for (const element of fieldsInput) {
      element.disabled = false;
      element.addEventListener("change", () => {
        this.#fieldsChanged = true;
        this.#domElements.get("button__verify").disabled = false;
      });
    }
    return marker;
  }

  _reset(e) {
    this.#addressMarker.removeFrom(this.#map);
    this.#map.setView(this.#storeCoords, 16);
    [...this.#domElements.get("button__verify").classList].includes("fail") &&
      this.#domElements.get("button__verify").classList.remove("fail");
    this.#domElements.get("button__verify").classList.remove("hidden");
    this.#domElements.get("button__verify").textContent = "Consultar";
    e.srcElement.classList.add("hidden");
    this._renderError({
      message: "Para buscar de nuevo, por favor ingresa otra dirección",
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
    this.#domElements.get("form__store").classList.add("hidden");

    //render next step (user choose the vertices)
    this.#domElements.get("form__vertices").classList.remove("hidden");

    this.#map.on("click", this._loadVerticesArray.bind(this));
  }

  _setLastStep() {
    //hide previous form
    this.#domElements.get("form__store").classList.add("hidden");
    //show last step form
    this.#domElements.get("form__address").classList.remove("hidden");

    this.#domElements
      .get("form__address")
      .addEventListener("submit", this._checkRange.bind(this));
  }

  async _getCoords(values) {
    //fetch geocoding
    const { street, number, city, country, county, postalCode } = values;
    const response = await fetch(
      `${
        this.#apiBaseUrl
      }format=json&street=${street}%20${number}&city=${city}&country=${country}&county=${county}&postalcode=${postalCode}`
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
      this.#domElements.get("button__verify").innerText = this.#successText;
      setTimeout(() => {
        this.#domElements.get("button__verify").classList.add("hidden");
      }, 2500);
    } else {
      this.#domElements.get("button__verify").classList.add("fail");
      this.#domElements.get("button__verify").innerHTML = this.#failText;
      setTimeout(() => {
        this.#domElements.get("button__verify").classList.add("hidden");
      }, 2500);
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
    this.#domElements.get(`input__v${this.#verticesCounter}`).value =
      JSON.stringify(coords);
  }

  _renderPolygon(event) {
    if (this.#step === this.#lastStep) {
      this.#rangePolygon = L.polygon(this.#verticesArray).addTo(this.#map);
    } else {
      event.preventDefault();
      //check if step 1 is done
      if (!this.#storeMarker) {
        this._renderError(
          {
            message: "Primero tenes que marcar el local en el mapa!",
          },
          this.#domElements.get("button__drawrange")
        );
        return;
      }

      //add polygon to map
      if (this.#verticesArray.length < 4) {
        return this._renderError(
          {
            message: "No seleccionaste todos los vertices",
          },
          this.#domElements.get("button__drawrange")
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
    this.#domElements.get("div__link--container").classList.remove("hidden");
    this.#domElements.get("anchor__link--delivery-range").href = link;
    this.#domElements.get("anchor__link--delivery-range").target = "_blank";

    //hide vertices form
    this.#domElements.get("form__vertices").classList.add("hidden");
    this.#domElements.get("div__sidebar--form").classList.add("completed");
  }

  _renderError(error, element) {
    const errorDiv = this.#domElements.get("div__error");
    const errorMsg = this.#domElements.get("p__error--message");
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
    } else {
      let timeout = setTimeout(() => {
        errorDiv.classList.add("hidden");
        clearTimeout(timeout);
      }, 2500);
    }
  }
}

const app = new App();
