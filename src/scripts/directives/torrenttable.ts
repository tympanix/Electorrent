
export let torrentBody = ['$document', '$compile', function($document, $compile) {
    return {
        restrict: 'A',
        controller: controller,
        bindToController: true,
        scope: {
          columns: "="
        },
        compile: compile
    };

    function controller() {
      this.$template = ""
      this.$renderColumns = []
      this.$rows = []
      this.$link = function() {}

      this.subscribe = function(row) {
        this.$rows.push(row)
      }

      this.renderTemplate = function() {
        if (!this.columns) return
        this.$renderColumns = this.columns.filter(function(c) {
          return c.enabled
        })
        let template = ""
        this.$renderColumns.forEach(function(c) {
          template = template + `<td data-col="${c.attribute}">${c.template}</td>`
        })
        
        this.$template = template
        this.$link = $compile(this.$template)
      }

      this.render = function() {
        this.renderTemplate()
        this.$rows.forEach(function(r) {
          r.render()
        })
      }
    }

    function compile(/*element, attr, ctrl*/) {
        return link;
    }

    function link(scope, element, attr, ctrl){
      ctrl.renderTemplate()

      scope.$watch(function() {
        return ctrl.columns
      }, function() {
        ctrl.render()
      }, true)
    }

}];

export let torrentRow = [function() {
    return {
        restrict: 'A',
        require: '^^torrentBody',
        scope: false,
        compile: compile
    }

    function compile(/*element, attr, ctrl*/) {
      return link
    }

    function link(scope, element, attr, ctrl){
      scope.render = function() {
        ctrl.$link(scope, function(clone) {
          element.append(clone)
        })
      }
      scope.render()
      ctrl.subscribe(scope)
    }

}];

