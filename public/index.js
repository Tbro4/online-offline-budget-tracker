let transactions = [];
let myChart;

fetch("/api/transaction")
  .then((response) => {
    return response.json();
  })
  .then((data) => {
    // save db data on global variable

    transactions = data;

    populateTotal();
    populateTable();
    populateChart();
  });

//gets called if there is an error sending data to the database so we can instead push it to IndexDB
function saveRecord(transaction) {
  console.log(transaction);
  const itemData = [{ name: transaction.name, value: transaction.value }];
  const dbName = "budget";

  const request = indexedDB.open(dbName, 1);

  request.onerror = (event) => {
    // Handle errors.
  };
  request.onupgradeneeded = (event) => {
    const db = event.target.result;

    // Create an objectStore to hold information about our customers. We're
    // going to use "ssn" as our key path because it's guaranteed to be
    // unique - or at least that's what I was told during the kickoff meeting.
    const objectStore = db.createObjectStore("items", { keyPath: "name" });

    // Create an index to search customers by name. We may have duplicates
    // so we can't use a unique index.
    objectStore.createIndex("value", "value", { unique: false });

    // Create an index to search customers by email. We want to ensure that
    // no two customers have the same email, so use a unique index.
    // objectStore.createIndex("email", "email", { unique: true });

    // Use transaction oncomplete to make sure the objectStore creation is
    // finished before adding data into it.
    objectStore.transaction.oncomplete = (event) => {
      // Store values in the newly created objectStore.
      const itemObjectStore = db
        .transaction("items", "readwrite")
        .objectStore("items");
      itemData.forEach(function (item) {
        itemObjectStore.add(item);
      });
    };
  };

  // const request = indexedDB.open("Budget", 1);

  // request.onupgradeneeded = (event) => {
  //   const db = event.target.result;

  //   const budgetItemStore = db.createObjectStore("Items", {
  //     keyPath: "name",
  //   });
  //   budgetItemStore.createIndex("value", "value");
  // };
  // console.log("saveRecord called");
  // console.log(typeof transaction.name);
  // console.log(typeof transaction.value);
  // request.onsuccess = () => {
  //   const db = request.result;
  //   const transaction = db.transaction(["Items"], "readwrite");
  //   const budgetItemStore = transaction.objectStore("Items");
  //   // const value = budgetItemStore.index("value");
  //   let name = transaction.name;
  //   let value = transaction.value;

  //   budgetItemStore.add({ name: name, value: value });
  // };
}

function populateTotal() {
  // reduce transaction amounts to a single total value
  let total = transactions.reduce((total, t) => {
    return total + parseInt(t.value);
  }, 0);

  let totalEl = document.querySelector("#total");
  totalEl.textContent = total;
}

function populateTable() {
  let tbody = document.querySelector("#tbody");
  tbody.innerHTML = "";

  transactions.forEach((transaction) => {
    // create and populate a table row
    let tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${transaction.name}</td>
      <td>${transaction.value}</td>
    `;

    tbody.appendChild(tr);
  });
}

function populateChart() {
  // copy array and reverse it
  let reversed = transactions.slice().reverse();
  let sum = 0;

  // create date labels for chart
  let labels = reversed.map((t) => {
    let date = new Date(t.date);
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  });

  // create incremental values for chart
  let data = reversed.map((t) => {
    sum += parseInt(t.value);
    return sum;
  });

  // remove old chart if it exists
  if (myChart) {
    myChart.destroy();
  }

  let ctx = document.getElementById("myChart").getContext("2d");

  myChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Total Over Time",
          fill: true,
          backgroundColor: "#6666ff",
          data,
        },
      ],
    },
  });
}

function sendTransaction(isAdding) {
  let nameEl = document.querySelector("#t-name");
  let amountEl = document.querySelector("#t-amount");
  let errorEl = document.querySelector(".form .error");

  // validate form
  if (nameEl.value === "" || amountEl.value === "") {
    errorEl.textContent = "Missing Information";
    return;
  } else {
    errorEl.textContent = "";
  }

  // create record
  let transaction = {
    name: nameEl.value,
    value: amountEl.value,
    date: new Date().toISOString(),
  };

  // if subtracting funds, convert amount to negative number
  if (!isAdding) {
    transaction.value *= -1;
  }

  // add to beginning of current array of data
  transactions.unshift(transaction);

  // re-run logic to populate ui with new record
  populateChart();
  populateTable();
  populateTotal();

  // also send to server
  fetch("/api/transaction", {
    method: "POST",
    body: JSON.stringify(transaction),
    headers: {
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/json",
    },
  })
    .then((response) => {
      return response.json();
    })
    .then((data) => {
      if (data.errors) {
        errorEl.textContent = "Missing Information";
      } else {
        // clear form
        nameEl.value = "";
        amountEl.value = "";
      }
    })
    .catch((err) => {
      // fetch failed, so save in indexed db
      console.log("That didnt worK!!");
      console.log(err);
      saveRecord(transaction);

      // clear form
      nameEl.value = "";
      amountEl.value = "";
    });
}

document.querySelector("#add-btn").onclick = function () {
  sendTransaction(true);
};

document.querySelector("#sub-btn").onclick = function () {
  sendTransaction(false);
};
