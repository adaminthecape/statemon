/** Statemon */ __version = '1.8'; /* Monitor the Vue state on live sites and localhost **/
let notes = {
    //: Instructions: Open Chrome, then Devtools (f12). Go to Sources, then Snippets.
    //: Add a snippet, name it, paste this script & run it (ctrl+Enter)
    //: Click a button to start ('monitor' to start monitoring)
    // ----
    // Example output:
    // => 0 app,loading ::  false --> true
    // => 1 admin,editMode ::  false --> true
    // => 0 admin,editMode ::  true --> false
    // meaning:
    // 2 changes detected in the last tick,
    // change[0]: app.loading changed from false to true
    // change[1]: admin.editMode changed from false to true
    // then editMode was toggled off in the next tick.
    // ----
    // I know there's no const in here. It's Chrome's fault.
    // ----
    // v1.1: vastly improved memory usage and garbage collection.
    // v1.2: added browser log output instead of console (toggle in options).
    //       output is faster with the browser & has less interference.
    // v1.4: made the browser output much prettier.
    // v1.5: (coming soon) todo: find the state without being given a div name
    // v1.6: added RAM overflow handling & better garbage collection.
    // v1.7: added feature: search the state & filter by path/tag
    // v1.8: improved search: added filters - example: app,settings, -> only return results within "app/settings/*"
};
/* Initialize variables: */
let options = {
    colors: {
        background: {
            "true": "#aa000080",
            "false": "#00aa0080"
        }
    },
    searchResultsLimit: 100, // limit the search results. you don't want to add 4000 new divs
    printSearchResultsToConsoleAsWell: false, // no comment
    intervalMillis: 500, // monitor() will check every x millis (higher = performance, lower = accuracy)
    logTarget: 'browser', // browser or console
    changed: {
        // e.g. 'item' [message] [from] oldVal [to] newVal
        message: '::',
        from: '',
        to: '-->',
    },
    added: {
        // e.g. 'item' [message] newVal
        message: 'added:'
    },
    silence: [
        // add keys here you don't want to hear about
        'app,loading','entities,loading',
        //'app,activeModuleId','app,activePageId'
    ],
    keysBase0: [
        // comment out whatever you don't want to monitor (greatly improves performance)
        "app", "statistics", "user", "profiles", "userLists",
        "admin", "dataSchemas", "entities", "powerUps",
        "applications", "entityDefinitions", "communications", "emailTemplates",
        "chats", "dataMappings", "handlebars"
    ],
    keysBase: [
        // all the top level keys you'd expect to find in the state (as of May 4 2021)
        "audit", "app", "statistics", "user", "profileFormCopy", "profiles", "userLists",
        "admin", "i18n", "files", "fileLists", "dataSchemas", "entities", "powerUps",
        "applications", "entityDefinitions", "communications", "emailTemplates",
        "external", "chats", "reportAbuse", "dataMappings", "handlebars"
    ]
};
let togglers = {
    // booleans for toggling
    monitoring: false,
    monitoringBusy: false, // to prevent concurrent looping
    showAdded: false, // show NEW items in the state (set to true if you like clutter)
    boxOpen: true // changeBox open/closed
};
let cacheNew = {}, // created on first loop of monitorFn
    cacheOld = {}, // doesn't exist until second loop of monitorFn
    app = null, // div#app
    store = null, // app.__vue__.$store
    state = null, // store.state
    changeArray = [], // changes get pushed here
    container = null, // container for the buttons
    changeBox = null, // text box into which to output changes
    searchBox = null, // box to search the state
    dumpVal = null, // pointer for addToDump
    buttonOffsetTop = 50, // so the buttons aren't on top of each other
    toggler = null, // for toggling buttons
    browserLogTxt = '', // to output to the browser
    stateCache = {}, // getStateData() cache
    oldValTemp = null, // temp variable for comparisons
    newValTemp = null, // temp variable for comparisons
    searchActive = false, // flag for search function
    searchKeyword = '',
    searchResults = [], // array to store search results
    searchFilters = [], // to filter results by source
    searchFiltersString = '',
    clickers = null,
    ramBox = null; // ram usage indicator

function init() {
    // remove statemon stuff if on first run
    document.getElementById('statemon-container')?.remove();
    // get app, store, state
    app = document.getElementById('app') || null;
    store = app?.__vue__.$store || null;
    state = store?.state || null;
    addTheStyles(); // make the buttons bearable
    addButtonContainer(); // does what it says
    createClickers();
    createButton('status', null, 'status');
    createButton('snapshot', getSnapshot, 'snapshot');
    createButton('toggleMonitoring', toggleMonitoring, 'monitor');
    createButton('toggleChanges', toggleChangeBox, 'hide changes');
    createButton('toggleHideAdded', toggleHideAdded, 'show additions');
    createButton('toggleSearchBox', toggleSearchBox, 'search');
    createSearchBox();
    createChangeBox();
    document.addEventListener('keydown', hideChangesOnKey);
} init(); /* just to collapse it */
/* Styles and logic for the ui: */
function hideChangesOnKey(e) {
    // hide the changeBox when a key is pressed
    if(e.keyCode == 17) // ctrl = 17
    {
        toggleChangeBox();
    }
}
function addTheStyles() {
    // add some nice styling for the buttons

    // remove existing styles
    document.getElementById('statemon-style')?.remove();

    var style = document.createElement('style');
    if(style)
    {
        style.id = 'statemon-style';
        style.innerHTML = `
            #statemon-search-form-container {
                display: flex;
            }
            #statemon-search-input {
                flex-grow: 1;
                width: 85%;
            }
            #statemon-search-filter {
                flex-grow: 1;
                width: 85%;
            }
            #statemon-search-go {
                width: 10%;
            }
            .statemon-container {
                position: absolute;
                top: 120px;
                right: 20px;
            }
            .statemon-changeBox {
                position: absolute;
                right: 20px;
                width: 440px;
                height: 300px;
                overflow-y: scroll;
                border: 1px solid green;
                opacity: 0.9;
                color: green;
                padding: 2px;
                display: flex;
                flex-direction: column;
                background: rgba(255,255,255);
                z-index: 1000000000;
            }
            .statemon-searchBox {
                overflow-x: hidden;
                position: absolute;
                right: 20px;
                width: 440px;
                height: 200px;
                overflow-y: scroll;
                border: 1px solid green;
                opacity: 0.9;
                color: green;
                padding: 2px;
                display: flex;
                flex-direction: column-reverse;
                background: rgba(255,255,255);
                z-index: 1000000000;
            }
            .statemon-changeBox > div {
                flex-grow: 1;
            }
            .scb-changed {
                color: green;
                border-bottom: 1px solid black;
            }
            .scb-added {
                color: blue;
                border-bottom: 1px solid black;
            }
            .scb-changed:hover {
                color: green;
                background: white;
            }
            .scb-item {
                color: black;
            }
            .scb-oldVal {
                color: maroon;
            }
            .scb-newVal {
                color: green;
            }
            .statemon-button {
                padding: 8px;
                margin: 2px;
                border: 1px solid green;
                border-radius: 6px;
                cursor: pointer;
                width: auto;
                height: auto;
                z-index: 10000;
            }
            .statemon-link-container {
                position: absolute;
                right: 10px;
                border: 1px solid green;
                cursor: pointer;
                width: auto;
                height: auto;
                background: 'rebeccapurple';
                z-index: 10000;
                text-align: center;
                display: flex;
                flex-direction: row;
                flex-wrap: auto;
                justify-content: flex-start;
            }
            .statemon-link-container > button {
                text-decoration: none;
                color: blue;
                flex-grow: 1;
            }
            .statemon-link {
                position: absolute;
                right: 20px;
                padding: 0 8px;
                border: 1px solid green;
                border-radius: 20px;
                cursor: pointer;
                width: auto;
                height: auto;
                background: 'rebeccapurple';
                z-index: 10000;
                text-align: center;
            }
            .statemon-button:hover {
                box-shadow: 0px 0px 0px 24px rgba(0,0,0,0.1);
                width: auto;
            }
        `;
        document.head.appendChild(style);
    }
}
function addButtonContainer() {
    var protoContainer = document.createElement('div');
    protoContainer.id = 'statemon-container';
    document.body.appendChild(protoContainer); // todo: make this scroll with the page
    container = document.getElementById('statemon-container');
}
function _createButton(id, onclick, label) {
    // deprecated in v1.9 - improved buttons
    // remove existing buttons
    document.getElementById('statemon-button-' + id)?.remove();
    // create the button
    var btn = document.createElement('button');
    if(btn && container)
    {
        btn.id = 'statemon-button-' + id;
        btn.innerText += label;
        btn.className += 'statemon-button';
        btn.style.top = 200 + buttonOffsetTop + 'px';
        btn.addEventListener("click", onclick);
        container.appendChild(btn);
        // buttonOffsetTop += 50;
    }
}
function createButton(id, onclick, label) {
    // remove existing buttons
    document.getElementById('statemon-button-' + id)?.remove();
    // create the button
    var btn = document.createElement('button');
    if(btn && container)
    {
        btn.id = 'statemon-button-' + id;
        btn.innerText += label;
        btn.className += 'statemon-button';
        // btn.style.top = 200 + buttonOffsetTop + 'px';
        btn.addEventListener("click", onclick);
        clickers?.appendChild(btn);
        // buttonOffsetTop += 50;
    }
}
function createClickers() {
    let id = 'statemon-clickers';
    // remove existing buttons
    document.getElementById(id)?.remove();
    // create the button
    var box = document.createElement('div');
    if(box)
    {
        box.id = id;
        box.className += 'statemon-link-container ' + id;
        box.style.top = '200px';
        container?.appendChild(box);
        clickers = document.getElementById(id);
    }
}
function createChangeBox() {
    let id = 'statemon-changeBox';
    // remove existing buttons
    document.getElementById(id)?.remove();
    // create the button
    var box = document.createElement('div');
    if(box)
    {
        box.id = id;
        box.className += 'statemon-changeBox';
        box.style.top = 200 + buttonOffsetTop + 'px';
        container?.appendChild(box);
        buttonOffsetTop += 500;
        changeBox = document.getElementById(id);
    }
}
function createSearchBox() {
    let id = 'statemon-searchBox';
    // remove existing buttons
    document.getElementById(id)?.remove();
    // create the button
    var box = document.createElement('div');
    if(box && container)
    {
        box.id = id;
        box.className += id;
        box.style.top = 200 + buttonOffsetTop + 'px';
        container?.appendChild(box);
        buttonOffsetTop += 200;
        searchBox = document.getElementById(id);

        searchBox.innerHTML += `
<div id="statemon-search-input-container">
    <input type="text" placeholder="Search the state..." id="statemon-search-input" value="` + searchKeyword + `" />
    <input type="text" placeholder="Filter by tag (delimiter: ;)" id="statemon-search-filter" value="` + searchFiltersString + `" />
    <button onClick="searchCache()" id="statemon-search-go">Go</button>
</div>
        `;
    }
}
function toggleSearchBox() {
    if(el)
    {
        el.style.background = togglers.boxOpen ? options.colors.background.true : options.colors.background.false;
    }
    // show/hide the search box (browser output)
    if(searchBox)
    {
        searchBox.style.display = togglers.boxOpen ? 'none' : 'flex';
        var el = document.getElementById('statemon-button-toggleSearch');
        if(el)
        {
            el.style.background = togglers.boxOpen ? options.colors.background.true : options.colors.background.false;
        }
    }

    togglers.boxOpen = !togglers.boxOpen;
}
function toggleChangeBox() {
    // show/hide the change box (browser output)
    if(changeBox)
    {
        changeBox.style.display = togglers.boxOpen ? 'none' : 'flex';
        var el = document.getElementById('statemon-button-toggleChanges');
        if(el)
        {
            el.style.background = togglers.boxOpen ? options.colors.background.true : options.colors.background.false;
            el.innerText = togglers.boxOpen ? 'show changes' : 'hide changes';
        }
    }

    togglers.boxOpen = !togglers.boxOpen;
}
function toggleBox(box, id, toggler, showText, hideText) {
    // show/hide the change box (browser output)
    if(box)
    {
        box.style.display = togglers[toggler] ? 'none' : 'flex';
        var el = document.getElementById(id);
        if(el) el.innerText = togglers[toggler] ? showText : hideText;
    }

    togglers[toggler] = !togglers[toggler];
}
/* On click listeners: */
function toggleMonitoring() {
    toggleSomething('statemon-button-toggleMonitoring', 'monitoring', monitor, 'stop monitoring', 'start monitoring');
}
function toggleHideAdded() {
    toggleSomething('statemon-button-toggleHideAdded', 'showAdded', null, 'show additions', 'hide additions');
}
function toggleSomething(id, bool, callback, textStarted = null, textStopped = null) {
    toggler = document.getElementById(id);
    if(!togglers[bool])
    {
        // fire it up
        if(textStarted) toggler.innerText = textStarted;
        toggler.style.background =  options.colors.background.false;
        togglers[bool] = true;
        if(callback) callback();
        return;
    }
    else
    {
        // kill it
        if(textStopped) toggler.innerText = textStopped;
        toggler.style.background = options.colors.background.true;
        togglers[bool] = false;
        return;
    }
}
function toggleSearchLoading() {
    goButton = document.getElementById('statemon-search-go');

    if(goButton)
    {
        if(searchActive)
        {
            goButton.innerHTML = 'Loading';
        }
        else
        {
            goButton.innerHTML = 'Go';
        }
    }
    else
    {
        console.log('no search button');
    }
}
/* Helpers: */
function isObjWithKeys(item) {
    return item && (typeof item === 'object') && Object.keys(item)?.length > 0;
}
function isReallyAnArray(item) {
    return item && Array.isArray(item) && item.length > 0; // don't judge me
}
function logArrayItems(arr, target = null) {
    // get the target div
    target = (target === 'search') ? searchBox : changeBox;

    if(target === searchBox)
    {
        // clear the results first
        if(searchBox.children.length > 1)
        {
            while (
                searchBox.firstChild
                && (searchBox.children.length > 1)
            ) {
                searchBox.removeChild(searchBox.firstChild);
            }
        }
    }
    // silence stuff, for example 'app,loading'
    if(options.silence.length > 0)
    {
        arr = arr.filter((x) =>
        {
            return !options.silence.includes(x.item);
        });
    }
    // iterate over the changes
    if(options.logTarget === 'console')
    {
        // print out each item of the array for chrome console
        // this prevents having to evaluate the object on click
        arr.forEach((x, i) => logItemToConsole(x, i));
    }
    else if(options.logTarget === 'browser')
    {
        arr.forEach((x, i) => logItemToBrowser(x, i, target));
    }
}
function logItemToConsole(x, i) {
    if(x.status === 'added' && togglers.showAdded)
    {
        console.log(
            i,
            x.item,
            options.added.message,
            x.newVal
        );
    }
    else if(x.status === 'changed')
    {
        console.log(
            i,
            x.item,
            options.changed.message,
            options.changed.from, x.oldVal,
            options.changed.to, x.newVal
        );
    }
}
function logItemToBrowser(x, i, target) {
    if(target)
    {
        if(target === searchBox)
        {
            //console.log(tag + ' ' + i,x.item,options.added.message,x.newVal);
            browserLogTxt = `
            <div class='scb-added'>
                <div class='scb-item'>` + '[' + i + '] ' + x.item.replaceAll(',', '/') + `</div>
                <div class='scb-newVal'>` + x.newVal + `</div>
            </div>
            `;
            target.innerHTML = browserLogTxt + target.innerHTML;
        }
        else if(x.status === 'added' && togglers.showAdded)
        {
            //console.log(tag + ' ' + i,x.item,options.added.message,x.newVal);
            browserLogTxt = `
            <div class='scb-added'>
                <div class='scb-item'>` + '[' + i + '] ' + x.item.replaceAll(',', '/') + `</div>
                <div class='scb-newVal'>` + x.newVal + `</div>
            </div>
            `;
            target.innerHTML = browserLogTxt + target.innerHTML;
        }
        else if(x.status === 'changed')
        {
            browserLogTxt = `
            <div class='scb-changed'>
                <div class='scb-item'>` + '[' + i + ']' + x.item.replaceAll(',', '/') + `</div>
                <div class='scb-oldVal'>` + x.oldVal + `</div>
                <div class='scb-newVal'>` + x.newVal + `</div>
            </div>
            `;
            target.innerHTML = browserLogTxt + target.innerHTML;
        }
    }
}
/* The hard workers: */
function getStateData() {
    /* get the state and copy it to a new object */
    // clear the cache
    stateCache = {};
    // for each key:
    options.keysBase.forEach((key) =>
    {
        // try to stringify the object
        try
        {
            stateCache[key] = JSON.parse(JSON.stringify(state[key]));
        }
        catch(e)
        {
            stateCache[key] = {};
            Object.keys(state[key]).forEach((k) =>
            {
                // try to copy deeper (app or admin needs this to work) (I forgot which)
                try { stateCache[key][k] = JSON.parse(JSON.stringify(state[key][k])); }
                catch(e) {/* do nothing */}
            });
        }
    });

    return stateCache;
}
function monitor() {
    /* monitor the state with a loop */ 
    // start checking ram usage
    let ramInterval = setInterval(() => {
        if(!togglers.monitoring)
        {
            clearInterval(ramInterval);
        }
        else
        {
            updateRamUsage();
        }
    }, 1000);
    // check the state exists
    if(state)
    {
        if(togglers.monitoring)
        {
            console.log('Monitoring started.');
        }
        let interval = setInterval(() =>
        {
            // destroy on max count
            if(!togglers['monitoring'])
            {
                clearInterval(interval);
                console.log('Monitoring finished - toggled by user.');
            }
            if(shouldDieBecauseTooMuchRam())
            {
                clearInterval(interval);
                console.log('Monitoring finished - too much RAM.');
            }

            monitorFn();
        }, options.intervalMillis);
    }
    else
    {
        console.log('State not available.');
    }
}
function monitorFn() {
    /* this is intended to be inside a loop! */
    if(togglers.monitoringBusy)
    {
        return;
    }
    else
    {
        togglers.monitoringBusy = true;

        // fill the dump with flat values pulled from the state
        iterateThis(getStateData(), addToDump, cacheNew);

        // check if there is an old cache
        if(Object.keys(cacheOld).length > 0)
        {
            // clear changes
            changeArray = [];

            // check each cache's values against each other
            Object.keys(cacheNew).forEach((key) =>
            {
                oldValTemp = JSON.stringify(cacheOld[key]);
                newValTemp = JSON.stringify(cacheNew[key]);
                if(cacheOld[key] === undefined)
                {
                    // item did not exist
                    changeArray.push({
                        status: 'added',
                        item: key,
                        oldVal: oldValTemp,
                        newVal: newValTemp
                    });
                }
                else if(oldValTemp !== newValTemp)
                {
                    // item existed already && has changed
                    changeArray.push({
                        status: 'changed',
                        item: key,
                        oldVal: oldValTemp,
                        newVal: newValTemp
                    });
                }
            });

            logArrayItems(changeArray);
        }

        // fill the old cache for the next iteration
        // iterateThis(getStateData(), addToDump, cacheOld);
        cacheOld = {};
        cacheOld = {...cacheNew}; // less hard work for the cpu

        togglers.monitoringBusy = false;
    }
}
function getSnapshot() {
    /* dump the state to the console */
    if(state)
    {
        console.log('snapshot::');
        console.log('cacheNew', cacheNew);
        console.log('cacheOld', cacheOld);
        console.log('stateCache', stateCache);
    }
}
function doStuffToThings(thingy, callback) {
    /* do stuff to all the stuff in the thing */
    if(isObjWithKeys(thingy))
    {
        // get the keys & recurse
        Object.keys(thingy).forEach((key) =>{
            iterateThis(thingy[key]);
        });
    }
    else if(isReallyAnArray(thingy))
    {
        thingy.forEach((subThingy) =>{
            iterateThis(subThingy);
        });
    }
    else
    {
        callback(thingy);
    }
}
function addToDump(arr, dump) {
    /* Fill a dump array with flattened values from an array (i.e. changeArray) */
    // set value in array: arr['path,to,item'] = value
    dumpVal = arr.pop();
    dump[arr.toString()] = dumpVal;
}
function iterateThis(thingy, callback, dump, depth = 0, breadcrumb = [])
{
    /* do [callback] to each non-object-or-array in the [thingy] up to [depth] */
    /* passes [...breadcrumb, thingy] to [callback]; handle this appropriately */

    // break on max depth
    if(depth > 24) return;

    if(isObjWithKeys(thingy))
    {
        // get the keys & recurse
        Object.keys(thingy).forEach((key) =>
        {
            iterateThis(thingy[key], callback, dump, depth + 1, [...breadcrumb, key]);
        });
    }
    else if(isReallyAnArray(thingy))
    {
        // recurse for each element
        thingy.forEach((subThingy) =>
        {
            iterateThis(subThingy, callback, dump, depth + 1, [...breadcrumb, subThingy]);
        });
    }
    else
    {
        // stop recursing
        callback([...breadcrumb, thingy], dump);
        // [...breadcrumb] is the path to the item & [thingy] is the value of the item
    }
}
/* Failsafes: */
function shouldDieBecauseTooMuchRam() {
    /* check RAM usage and empty vars if full */ 
    if(currentRamUsage() > 500)
    {
        cacheNew = {};
        cacheOld = {};
        stateCache = {};
    }
}
function trimChanges() {
    /* remove elements from changeBox if it gets too large */
    if(changeBox.children.length > 50)
    {
        let count = 0;
        while (
            changeBox.firstChild
            && (changeBox.children.length > 10)
            && count++ < 100
        ) {
            changeBox.removeChild(changeBox.lastChild);
        }
    }
}
function updateRamUsage() {
    /* output RAM usage to the ui */ 
    if(togglers.monitoring)
    {
        let ramBox = document.getElementById('statemon-button-status');
        let x = currentRamUsage();
        if(x > 500) shouldDieBecauseTooMuchRam();
        if(ramBox) ramBox.innerHTML = 'RAM: ' + x + ' MB';
    }
}
function currentRamUsage() {
    /* get current RAM usage */ 
    return Math.round(window.performance.memory.usedJSHeapSize / 1048536);
}
/* Search: */
function searchCache() {
    /* search the cache for a string */
    searchKeyword = null;
    searchFilters = null;
    searchFiltersString = null;
    searchKeyword = document.getElementById('statemon-search-input')?.value || '';
    searchKeyword = searchKeyword.toLowerCase(); // todo: add case match support
    searchFilters = [];
    searchFiltersString = document.getElementById('statemon-search-filter')?.value || '';

    if(searchFiltersString !== '')
    {
        // make it an array
        searchFilters = searchFiltersString.split(';');
    }

    // build a cache if none exists
    if(Object.keys(cacheNew)?.length === 0 && !togglers.monitoring)
    {
        monitorFn();
        searchCache();
        return;
    }

    // search
    if(searchKeyword !== '' && Object.keys(cacheNew)?.length > 0)
    {
        searchResults = [];
        searchActive = true;
        toggleSearchLoading();

        if(searchFilters.length > 0)
        {
            // iterate over the object and find the keyword
            Object.keys(cacheNew).forEach((key) =>
            {
                if(searchResults.length < options.searchResultsLimit)
                {
                    // apply the filter
                    searchFilters.forEach((item) =>
                    {
                        if(key.indexOf(item) > -1)
                        {
                            if(JSON.stringify(cacheNew[key]).toLowerCase().indexOf(searchKeyword) > -1)
                            {
                                // keyword found
                                searchResults.push({
                                    item: key,
                                    newVal: cacheNew[key]
                                });
                            }
                        }
                    });
                }
            });
        }
        else
        {
            // iterate over the object and find the keyword
            Object.keys(cacheNew).forEach((key) =>
            {
                if(searchResults.length < options.searchResultsLimit)
                {
                    if(JSON.stringify(cacheNew[key]).toLowerCase().indexOf(searchKeyword) > -1)
                    {
                        // keyword found
                        searchResults.push({
                            item: key,
                            newVal: cacheNew[key]
                        });
                    }
                }
            });
        }

        if(options.printSearchResultsToConsoleAsWell)
        {
            console.log('statemon search results:', searchResults);
        }
        if(searchResults.length === 0)
        {
            searchResults.push({
                item: 'No results!',
                newVal: null
            });
        }

        // trim the array
        while (searchResults.length > options.searchResultsLimit) {
            searchResults.pop();
        }

        setTimeout(() =>
        {
            searchActive = false;
            toggleSearchLoading();
            logArrayItems(searchResults, 'search');
        }, 200);
    }
}
/* Remove if not using as a Chrome snippet */ function helloWorld() {
    /* Prints to the console when run as a Chrome snippet */
    return 'Statemon v' + __version + ' **Monitor/search the Vue state** Ready to start...';
} helloWorld();