var request = require("request");
var axios = require("axios");
var https = require('https');
var webexPack = require('webex');
var crypto = require('crypto');
const config = require("../config.json");
const detailsCard_Employee = require('../adaptivecards/detailsCard_Employee.json');
const detailsCard_Manager = require('../adaptivecards/detailsCard_Manager.json');
const thankyouCard_Employee = require('../adaptivecards/thankyouEmployee.json');
const thankyouCard_Manager = require('../adaptivecards/thankyouManager.json');
const welcomeMessageCard = require('../adaptivecards/welcomeMessage.json');
const Charitycontribution = require('../models/Charity');

// Headers to be used with API calls to Hydra
const headers = { Authorization: "Bearer " + config.token };

// Object to store user input values which go into the DB
var cardDetails = {
  "amount": '',
  "charityname": '',
  "user": '',
  "business_unit": '',
  "email": '',
  "hash": '',
  "_id": '',
  "date": ''
}

//webex connection 
const webex = webexPack.init({
  credentials: {
    access_token: config.token
  }
});

//API call template for basic text message
var textOptions = {
  method: "POST",
  url: "https://api.ciscospark.com/v1/messages",
  headers: {
    "Content-Type": "application/json",
    Authorization: "Bearer " + config.token
  },
  body: {
    roomId: "",
    text: ""
  },
  json: true
};

//API call template with attachments
var cardOptions = {
  method: "POST",
  url: "https://api.ciscospark.com/v1/messages",
  headers: {
    "Content-Type": "application/json",
    Authorization: "Bearer " + config.token
  },
  body: {
    roomId: "",
    text: "This bot is not supported on your current teams app. Please chat with me using the latest version of the WebEx Teams desktop app",
    attachments: []
  },
  json: true
};

//passing value to json of thankyouCard_employee
function thankyouCard_Employees(thankyouCard_Employee, key) {
  if (thankyouCard_Employee !== null && thankyouCard_Employee !== undefined) {
    Object.keys(thankyouCard_Employee).forEach((property) => {
      if (Object.prototype.hasOwnProperty.call(thankyouCard_Employee, property)) {
        if (property === key) {
          if (thankyouCard_Employee[property] === 'Amount :')
            thankyouCard_Employee['value'] = "$" + cardDetails.amount;
          else if (thankyouCard_Employee[property] === 'Charity Name :')
            thankyouCard_Employee['value'] = cardDetails.charityname;
          else if (thankyouCard_Employee[property] === 'Business Unit :')
            thankyouCard_Employee['value'] = cardDetails.business_unit;
        }
        else if (typeof thankyouCard_Employee[property] === 'object') {
          thankyouCard_Employees(thankyouCard_Employee[property], key);
        }
      }
    });
  }
}

//passing value to json of thankyouCard_manager  
function thankyouCard_Managers(thankyouCard_Manager, key) {
  if (thankyouCard_Manager !== null && thankyouCard_Manager !== undefined) {
    Object.keys(thankyouCard_Manager).forEach((property) => {
      if (Object.prototype.hasOwnProperty.call(thankyouCard_Manager, property)) {
        if (property === key) {
          if (thankyouCard_Manager[property] === 'Amount :')
            thankyouCard_Manager['value'] = "$" + cardDetails.amount;
          else if (thankyouCard_Manager[property] === 'Business Unit :')
            thankyouCard_Manager['value'] = cardDetails.business_unit;
        }
        else if (typeof thankyouCard_Manager[property] === 'object') {
          thankyouCard_Managers(thankyouCard_Manager[property], key);
        }
      }
    });
  }
}

//Card sending function
function sendCard(req, cardContent) {
  cardOptions.body.roomId = req.roomId;
  cardOptions.body.attachments = [{
    contentType: "application/vnd.microsoft.card.adaptive",
    content: cardContent
  }];

  request(cardOptions, function (error, response, body) {
    basicMessageId = body.id;
    if (error) throw new Error(error);
  });
}

// Check if user input data is numeric
function isNumeric(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

function getPersonEmailFromId(personId, result) {
  const getRequest = {
    method: "GET",
    url: `https://api.ciscospark.com/v1/people/${personId}`,
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + config.token
    }
  }

  request(getRequest, function (error, response, body) {
    if (error) {
      result(err, null)
    } else {
      jsonData = JSON.parse(body);
      if (jsonData.emails.length > 0) {
        cardDetails.email = jsonData.emails[0];
        result(null, true)
      } else {
        result(new Error("No email(s) found for the person ID"), null);
      }
    }
  });
}


module.exports = app => {
  //text messages
  app.post("/api/v1/allMessages", (req, res) => {
    console.info("Reached messages node");
    console.log(req.body);
    if ((req.body.data.personEmail === config.botEmail && req.body.event.toLowerCase() === "created" && req.body.resource.toLowerCase() === "memberships" && req.body.data.roomType === "group") || (req.body.data.personEmail != config.botEmail && req.body.event.toLowerCase() === "created" && req.body.resource.toLowerCase() === "messages")) {
      sendCard(req.body.data, welcomeMessageCard);
    }
  });

  //attachment buttons 
  app.post("/api/v1/attachmentActions", (req, res) => {
    console.info("Reached attachmentActions node");
    const url =
      "https://api.ciscospark.com/v1/attachment/actions/" + req.body.data.id;

    const headers = {
      Authorization: "Bearer " + config.token
    };
    axios
      .get(url, { headers: headers })
      .then(result => {
        console.log(result.data);
        switch (result.data.inputs.buttonId) {
          case "employeeBtn":
            cardDetails.user = "employee";
            sendCard(result.data, detailsCard_Employee);
            break;
          case "managerBtn":
            cardDetails.user = "manager"
            sendCard(result.data, detailsCard_Manager);
            break;
          case "detailsSubmit":
            if (!isNumeric(result.data.inputs.amountInput)) {
              webex.messages.create({
                markdown: 'The **amount** entered is not a number. Please enter a number and re-submit the form.',
                roomId: result.data.roomId,
              })
            }
            else {
              getPersonEmailFromId(result.data.personId, (err, response) => {
                if (err) {
                  console.error(err, 'Error in getting person email')
                  res.status(500).json({
                    "message": "Internal Server Error"
                  });
                } else {
                  cardDetails.hash = crypto.createHash('sha256').update(cardDetails.email).digest('hex');
                  cardDetails.amount = result.data.inputs.amountInput;
                  cardDetails.date = Date(Date.now()).toString();
                  cardDetails.charityname = result.data.inputs.preferredCharity;
                  cardDetails.business_unit = result.data.inputs.businessUnit;
                  if (!cardDetails.charityname) {
                    cardDetails.charityname = "-- No Preference --";
                  }
                  const charitycontribution_storage = new Charitycontribution({
                    email: cardDetails.hash,
                    type_of_contributor: cardDetails.user,
                    business_unit: cardDetails.business_unit,
                    contribution_amount_in_dollars: cardDetails.amount,
                    charity_name: cardDetails.charityname,
                    date: cardDetails.date
                  });
                  charitycontribution_storage.save()
                    .then(mongoDbResult => {
                      console.log('Data Updated');
                      if (cardDetails.user == "employee") {
                        thankyouCard_Employees(thankyouCard_Employee, 'title');
                        sendCard(result.data, thankyouCard_Employee);
                      }
                      else {
                        thankyouCard_Managers(thankyouCard_Manager, 'title');
                        sendCard(result.data, thankyouCard_Manager);
                      }
                      res.status(200).json({
                        "message": "OK"
                      })
                    })
                    .catch(err => {
                      console.log(err);
                      webex.messages.create({
                        markdown: 'An **Internal Server Error** has occured. Can you please re-start the process.',
                        roomId: result.data.roomId,
                      })
                    });
                }
              });
            }
            break;
        }
      })
      .catch(err => console.log(err));
  });

};