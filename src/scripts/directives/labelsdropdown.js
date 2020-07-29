angular.module("torrentApp").directive("labelsDropdown", [
  function () {
    return {
      restrict: "A",
      templateUrl: "./views/misc/labels.html",
      scope: {
        enabled: "=?",
        action: "=",
        labels: "=",
      },
      link: function (scope) {
        scope.form = { label: "Some Label" };

        scope.openNewLabelModal = function () {
          $("#newLabelModal").modal("show");
        };

        scope.applyNewLabel = function (label) {
          console.log("Passed label:", label);
          console.log("New label:", scope.form.label);
        };
      },
    };
  },
]);
