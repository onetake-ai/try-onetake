// OneTake AI - Cohort Assignment
// Assigns users to one of 12 cohorts based on unix timestamp at checkout time.

(function() {
    'use strict';

    // Returns a cohort number from 1 to 12.
    // Uses the unix timestamp in seconds modulo 12, plus 1.
    function assignCohort() {
        return 1 + (Math.floor(Date.now() / 1000) % 12);
    }

    window.oneTakeCohort = {
        assignCohort: assignCohort
    };

})();
