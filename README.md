# Forsyth Signal

Find the signal through the noise or smth idk (is this a tuff slogan??) no

Anyway, this was built for the 2026 Congressional App Challenge. We're totally winning. 

## Functions
The main purpose of Forsyth Signal is to encourage people to participate in civics. It can be hard to find information about civic meetings, where development plans are happening, and where public hearing signs are. That's why we built this web app. 

 - Browse through upcoming meetings
 - See active development plans
 - Go through past zoning areas
 - See what affects you

## For the developers
Here's the basic outline of the project

 - api --- you don't need to touch it, probably

 - data --- you don't need to touch it

 - src --- this is the rust backend

 - web --- this is the frontend

 - anything in the root --- please don't touch :)

### IMPORTANT!!!!!!!
If you are running this project, you will need rust installed. To open the project on a local development server, run the following in the terminal:

```cargo run --bin forsyth-signal```

### TESTING
To test mock events/details screen when the backend is being blocked by network restrictions, run this in console
```
(async () => {
  const futureDate = days =>
    new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  const mockEvents = [
    {
      id: "mock-001",
      title: "Sample Planning Commission Hearing",
      category: "development",
      state: "upcoming",
      status: "Scheduled",
      date: futureDate(7),
      location: "Somewhere in Forsyth ig",
      latitude: 34.207,
      longitude: -84.14,
      summary: "A sample public hearing about a proposed neighborhood development.",
      description: "The commission will discuss the proposal, hear public comments, and consider next steps.",
      why_it_matters: "Residents can learn about the proposal and share feedback before a decision is made. Or not.",
      source_name: "Mock source",
      source_url: "",
      geometry: null
    }
  ];

  const cache = await caches.open("forsyth-signal-events-v1");
  await cache.put(
    "/api/events",
    new Response(JSON.stringify(mockEvents), {
      headers: { "Content-Type": "application/json" }
    })
  );

  location.reload();
})();
```
