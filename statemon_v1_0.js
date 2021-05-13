/** Statemon v1.0 :: Monitor the Vue state on live sites and localhost **/
/* output example: */ {
    // => 0 app,loading ::  false --> true
    // => 1 admin,editMode ::  false --> true
    // => 0 admin,editMode ::  true --> false
    // meaning:
    // 2 changes detected in the last tick,
    // change[0]: app.loading changed from false to true
    // change[1]: admin.editMode changed from false to true
    // then editMode was toggled off in the next tick.
}

/* Initialize variables: */
let options = {
    intervalMillis: 250, // monitor() will check every x millis (change this for performance)
    changed: {
        // e.g. 'item' [message] [from] oldVal [to] newVal
        message: '::', // e.g. 'changed'
        from: '', // e.g. 'from'
        to: '-->', // e.g. 'to'
    },
    added: {
        // e.g. 'item' [message] newVal
        message: 'added:'
    }
};
let monitoring = false,
    cacheNew = {}, // created on first loop of monitorFn
    cacheOld = {}, // doesn't exist until second loop of monitorFn
    app = null, // div#app
    store = null, // app.__vue__.$store
    state = null, // store.state
    changeArray = [], // changes get pushed here
    dump = [], // just a dump, not used atm
    container = null, // container for the buttons
    dumpVal = null, // pointer for fillDump. I'm trying to save memory
    buttonOffsetTop = 0; // so the buttons aren't on top of each other
// keysBase: all the top level keys you'd expect to find in the state (as of May 4 2021)
let keysBase = [
    // comment out whatever you don't want to monitor (greatly improves performance)
    //'chats','profiles','user','statistics','app','entities','powerUps','communications'
    "audit", "app", "statistics", "user", "profileFormCopy", "profiles", "userLists",
    "admin", "i18n", "files", "fileLists", "dataSchemas", "entities", "powerUps",
    "applications", "entityDefinitions", "communications", "emailTemplates",
    "external", "chats", "reportAbuse", "dataMappings", "handlebars"
];

// get app, store, state
app = document.getElementById('app');
store = app.__vue__.$store;
state = store.state;

addTheStyles(); // make the buttons bearable
addButtonContainer(); // does what it says
createButton('snapshot', getSnapshot, 'snapshot');
createButton('toggleMonitoring', toggleMonitoring, 'monitor');

/* Styles and logic for creating buttons: */
function addTheStyles() {
    // add some nice styling for the buttons

    // remove existing styles
    document.getElementById('statemon-style')?.remove();

    var style = document.createElement('style');
    style.id = 'statemon-style';
    style.innerHTML = `
        .statemon-container {
            position: absolute;
            top: 120px;
            right: 20px;
        }
        .statemon-button {
            position: absolute;
            right: 20px;
            padding: 20px;
            border: 1px solid green;
            border-radius: 20px;
            cursor: pointer;
            width: auto;
            height: 40px;
            background: 'rebeccapurple';
            z-index: 10000;
            text-align: center;
            line-height: 0px;
        }
        .statemon-button:hover {
            box-shadow: 0px 0px 0px 24px rgba(0,0,0,0.1);
            width: auto;
        }
    `;
    document.head.appendChild(style);
}
function addButtonContainer() {
    var protoContainer = document.createElement('div');
    protoContainer.id = 'statemon-container';
    var header = document.getElementsByTagName('header')[0];
    header.appendChild(protoContainer);
    container = document.getElementById('statemon-container');
}
function createButton(id, onclick, label) {
    // remove existing buttons
    document.getElementById('statemon-button-' + id)?.remove();

    var btn = document.createElement('button');
    btn.id = 'statemon-button-' + id;
    btn.innerText += label;
    btn.className += 'statemon-button';
    btn.style.top = 200 + buttonOffsetTop + 'px';
    btn.addEventListener("click", onclick);
    container?.appendChild(btn);
    buttonOffsetTop += 50;
}
/* On click listeners: */
function toggleMonitoring() {
    let toggler = document.getElementById('statemon-button-toggleMonitoring')
    if(!monitoring)
    {
        // fire it up
        monitor();
        monitoring = true;
        toggler.innerText = 'stop monitoring';
    }
    else
    {
        monitoring = false;
        toggler.innerText = 'start monitoring';
    }
}
/* Helpers: */
function isObjWithKeys(item) {
    return item && (typeof item === 'object') && Object.keys(item)?.length > 0;
}
function isArray(item) {
    return item && Array.isArray(item) && item.length > 0; // don't judge me
}
function oldCacheVal(key) {
    return JSON.stringify(cacheOld[key]);
}
function newCacheVal(key) {
    return JSON.stringify(cacheNew[key]);
}
function logArrayItems(arr, tag = '', hideAdded = false) {
    // print out each item of the array for chrome console
    // this prevents having to evaluate the object on click
    arr.forEach((x, i) =>
    {
        // console.log(tag + ' ' + i, JSON.stringify(x));
        if(x.status === 'added' && !hideAdded)
        {
            console.log(
                tag + ' ' + i,
                x.item,
                options.added.message,
                x.newVal
            );
        }
        else if(x.status === 'changed')
        {
            console.log(
                tag + ' ' + i,
                x.item,
                options.changed.message,
                options.changed.from, x.oldVal,
                options.changed.to, x.newVal
            );
        }
    });
}
/* The hard workers: */
function getStateData() {
    // create a cache
    let result = {};
    // for each key:
    keysBase.forEach((key) =>
    {
        // try to stringify the object
        try {
            result[key] = JSON.parse(JSON.stringify(state[key]));
        } catch(e) {
            // console.log('oops in:', key);
            result[key] = {};
            Object.keys(state[key]).forEach((k) =>
            {
                // try to copy deeper
                try { result[key][k] = JSON.parse(JSON.stringify(state[key][k])); }
                catch(e) {/* do nothing */}
            });
        }
    });

    return result;
}
function monitor() {
    // check the state exists
    if(state)
    {
        let interval = setInterval(() =>
        {
            // destroy on max count
            if(!monitoring)
            {
                clearInterval(interval);
                console.log('Monitoring finished.');
            }
            monitorFn();
        }, options.intervalMillis);
    }
}
function monitorFn() {
    // fill the dump with flat values pulled from the state
    iterateThis(getStateData(), fillDump, cacheNew);

    // check if there is an old cache
    if(Object.keys(cacheOld).length > 0)
    {
        // clear changes
        changeArray = [];

        // check each cache's values against each other
        Object.keys(cacheNew).forEach((key) =>
        {
            let oldValue = oldCacheVal(key),
                newValue = newCacheVal(key);
            // check if item exists
            if(cacheOld[key] === undefined)
            {
                // item did not exist
                changeArray.push({
                    status: 'added',
                    item: key,
                    oldVal: oldValue,
                    newVal: newValue
                });
            }
            else if(oldValue !== newValue)
            {
                // item existed already && has changed
                changeArray.push({
                    status: 'changed',
                    item: key,
                    oldVal: oldValue,
                    newVal: newValue
                });
            }
            // else, there was no change therefore do nothing
        });
    }

    logArrayItems(changeArray, '', true);

    // fill the old cache for the next iteration
    iterateThis(getStateData(), fillDump, cacheOld);

    // console.log('dump:', cacheNew, cacheOld);
}
function getSnapshot() { // deprecated
    // basically, if the state exists, do monitorFn once
    if(state)
    {
        console.log('snapshot::');
        monitorFn();
    }
}
/* get all the data and flatten it: */
function doStuffToThings(thingy, callback) {
    // do stuff to all the stuff in the thing
    if(isObjWithKeys(thingy))
    {
        // get the keys & recurse
        Object.keys(thingy).forEach((key) =>{
            iterateThis(thingy[key]);
        });
    }
    else if(isArray)
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
function iterateThis(thingy, callback, dump, depth = 0, breadcrumb = [])
{
    // break on max depth
    if(depth > 10) return;

    if(isObjWithKeys(thingy))
    {
        // get the keys & recurse
        Object.keys(thingy).forEach((key) =>
        {
            iterateThis(thingy[key], callback, dump, depth + 1, [...breadcrumb, key]);
        });
    }
    else if(isArray(thingy))
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
        // [...breadcrumb, thingy] returns an array with the path to the item
        // and the last item in the array is the value of the item
        callback([...breadcrumb, thingy], dump);
    }
}
/* Fill a dump array with flattened values from an array: */
function fillDump(arr, dump) {
    // set value in array: arr['path,to,item'] = value
    dumpVal = arr.pop();
    dump[arr.toString()] = dumpVal;
}