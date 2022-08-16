const express = require("express");
const app = express();
app.use(express.json());

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;

const initializaDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server started at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error : ${e.message}`);
    process.exit(1);
  }
};
initializaDBAndServer();

//login api
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `
    SELECT 
        *
    FROM 
      user 
    WHERE username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatch = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatch === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "SIM-RAN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//authenticate token
const authentication = (request, response, next) => {
  let jwtToken;
  const authHeaders = request.headers["authorization"];
  if (authHeaders !== undefined) {
    jwtToken = authHeaders.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "SIM-RAN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

const convertStateTable = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

const covertDistrictTable = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

//get api
app.get("/states/", authentication, async (request, response) => {
  const selectUserQuery = `
        SELECT * 
        FROM state;`;
  const stateArray = await db.all(selectUserQuery);
  response.send(stateArray.map((eachState) => convertStateTable(eachState)));
});

//get state api with id
app.get("/states/:stateId/", authentication, async (request, response) => {
  const { stateId } = request.params;
  const selectUserQuery = `
      SELECT * 
      FROM state 
      WHERE state_id = ${stateId};`;
  const state = await db.get(selectUserQuery);
  response.send(convertStateTable(state));
});

//post district
app.post("/districts/", authentication, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const selectUserQuery = `
      INSERT INTO
        district(district_name, state_id, cases, cured, active, deaths)
        VALUES('${districtName}', ${stateId}, ${cases}, ${cured},
          ${active}, ${deaths});`;

  const stateUpdate = await db.run(selectUserQuery);
  response.send("District Successfully Added");
});

//get district id
app.get(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;
    const selectUserQuery = `
     SELECT 
        * 
     FROM 
        district 
     WHERE 
        district_id = ${districtId};`;
    const districtWithId = await db.get(selectUserQuery);
    response.send(covertDistrictTable(districtWithId));
  }
);

//delete district based on id
app.delete(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;
    const selectUserQuery = `
      DELETE 
      FROM district 
      WHERE district_id = ${districtId};`;

    const deleteDis = await db.run(selectUserQuery);
    response.send("District Removed");
  }
);

//update api
app.put(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const selectUserQuery = `
    UPDATE 
        district
    SET
       district_name = '${districtName}',
       state_id = ${stateId},
       cases = ${cases},
       cured = ${cured},
       active = ${active},
       deaths = ${deaths};`;
    const update = db.run(selectUserQuery);
    response.send("District Details Updated");
  }
);

//stats api
app.get(
  "/states/:stateId/stats/",
  authentication,
  async (request, response) => {
    const { stateId } = request.params;
    const selectUserQuery = `
      SELECT 
        SUM(cases),
        SUM(cured),
        SUM(active),
        SUM(deaths)
    FROM district     
    WHERE state_id = ${stateId};`;

    const stats = await db.get(selectUserQuery);
    response.send({
      totalCases: stats["SUM(cases)"],
      totalCured: stats["SUM(cured)"],
      totalActive: stats["SUM(active)"],
      totalDeaths: stats["SUM(deaths)"],
    });
  }
);

module.exports = app;
