(function () {
    "use strict";
	function AllinOneAccessibilityController($q, $scope, assetsService, $timeout) {


		var vm = this;

		vm.edit = false;
		vm.icontype = "";
		vm.iconsize= "";
		vm.color = "";
		vm.position = "";
		vm.positionArr = [
			"top-left",
			"top-center",
			"top-right",
			"middle-left",
			"middle-right",
			"bottom-left",
			"bottom-center",
			"bottom-right"
		];
		vm.add = function () {
			console.info($scope,"info");
			$scope.model.value = {
				"color": "754785",
				"position": "bottom-right",
				"icontype":"aioa-icon-type-2",
				"iconsize":"default"
			}

			vm.edit = true;
		}
		vm.save=function (){
			console.info($scope,$scope.model,"save");
		}

    }

    angular.module("umbraco").controller("AllinOneAccessibility.Controller", AllinOneAccessibilityController);
})();
