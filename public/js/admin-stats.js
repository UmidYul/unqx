(function initAdminStats() {
  const dataNode = document.getElementById("global-stats-data");
  const canvas = document.getElementById("global-stats-chart");

  if (!dataNode || !canvas || typeof Chart === "undefined") {
    return;
  }

  const data = JSON.parse(dataNode.textContent || "[]");

  new Chart(canvas, {
    type: "line",
    data: {
      labels: data.map((item) => item.date),
      datasets: [
        {
          label: "Все просмотры",
          data: data.map((item) => item.views),
          borderColor: "#111827",
          backgroundColor: "rgba(17,24,39,0.08)",
          borderWidth: 2.5,
          tension: 0.25,
          pointRadius: 2,
          fill: false,
        },
        {
          label: "Уникальные",
          data: data.map((item) => item.uniqueViews),
          borderColor: "#10b981",
          backgroundColor: "rgba(16,185,129,0.08)",
          borderWidth: 2.5,
          tension: 0.25,
          pointRadius: 2,
          fill: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0,
          },
          grid: {
            color: "#dddddd",
            borderDash: [3, 3],
          },
        },
        x: {
          grid: {
            color: "#dddddd",
            borderDash: [3, 3],
          },
        },
      },
    },
  });
})();
