const examples = {
  loop: {
    filename: "main.cpp",
    description: "Window · input · frame · draw · present",
    code: `#include "pxl1.h"

int main() {
    pxl1::InitWindow(960, 720, "My first PXL/1 game");
    pxl1::SetTargetFPS(60);

    float playerX = 150.0f;
    while (!pxl1::WindowShouldClose()) {
        const float dt = pxl1::GetFrameTime();
        if (pxl1::IsKeyDown(pxl1::Key::left))  playerX -= 100.0f * dt;
        if (pxl1::IsKeyDown(pxl1::Key::right)) playerX += 100.0f * dt;

        pxl1::BeginDrawing({16, 20, 42});
        pxl1::DrawRectangle(
            static_cast<int>(playerX), 100, 16, 16,
            pxl1::colors::raywhite
        );
        pxl1::EndDrawing();
    }
    pxl1::CloseWindow();
}`,
    language: "cpp"
  },
  texture: {
    filename: "textured_model.cpp",
    description: "Load an image · upload a texture · draw every frame",
    code: `#include "pxl1.h"

int main() {
    pxl1::InitWindow(960, 720, "Textured model");
    pxl1::SetTargetFPS(60);

    auto ship = pxl1::LoadModel("assets/ship.obj");
    auto image = pxl1::LoadImage("assets/ship.png");
    auto texture = pxl1::LoadTextureFromImage(image);
    pxl1::UnloadImage(image);

    while (!pxl1::WindowShouldClose()) {
        pxl1::BeginDrawing({16, 20, 42});
        pxl1::DrawModel(
            ship, {0, 0, 2}, 1.0f, texture
        );
        pxl1::EndDrawing();
    }

    pxl1::UnloadTexture(texture);
    pxl1::UnloadModel(ship);
    pxl1::CloseWindow();
}`,
    language: "cpp"
  },
  mesh: {
    filename: "camera_mesh.cpp",
    description: "Build a mesh · set a camera · draw in 3D",
    code: `#include "pxl1.h"

int main() {
    pxl1::InitWindow(960, 720, "Cube in space");
    pxl1::SetTargetFPS(60);

    pxl1::Camera3D camera;
    camera.position = {0, 1, -6};
    camera.target = {0, 0, 0};
    pxl1::SetCamera(camera);

    const auto cube = pxl1::shapes::cube(
        1.5f, {240, 130, 70}
    );
    while (!pxl1::WindowShouldClose()) {
        pxl1::BeginDrawing({16, 20, 42});
        pxl1::DrawModel(cube, {0, 0, 0}, 1.0f);
        pxl1::EndDrawing();
    }
    pxl1::CloseWindow();
}`,
    language: "cpp"
  },
  ui: {
    filename: "game_ui.cpp",
    description: "Bitmap text · mouse input · common game UI widgets",
    code: `#include "pxl1.h"

int main() {
    pxl1::InitWindow(960, 720, "PXL/1 game UI");
    bool soundEnabled = true;
    float volume = 0.75f;

    while (!pxl1::WindowShouldClose()) {
        pxl1::BeginDrawing({16, 20, 42});
        pxl1::DrawText("OPTIONS", 12, 12, 10, pxl1::colors::white);
        pxl1::GuiPanel({8, 32, 150, 70});
        soundEnabled = pxl1::GuiCheckBox(
            {16, 42, 130, 12}, "SOUND", soundEnabled
        );
        volume = pxl1::GuiSlider(
            {16, 62, 120, 8}, volume, 0.0f, 1.0f
        );
        if (pxl1::GuiButton({16, 82, 120, 14}, "PLAY")) {
            // Start the game.
        }
        pxl1::DrawFPS(270, 8);
        pxl1::EndDrawing();
    }
    pxl1::CloseWindow();
}`,
    language: "cpp"
  }
};

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function highlightCpp(source) {
  const tokenPattern = /(\/\/[^\n]*|"(?:\\.|[^"\\])*"|\b(?:#include|int|float|bool|const|auto|while|if|return|static_cast)\b|\b(?:main|InitWindow|SetTargetFPS|WindowShouldClose|IsKeyDown|IsMouseButtonPressed|GetMousePosition|GetMouseDelta|DisableCursor|EnableCursor|IsCursorHidden|SetMousePosition|UpdateCameraFromMouse|UpdateOrbitCameraFromMouse|GetFrameTime|GetFPS|DrawFPS|BeginDrawing|DrawRectangle|DrawText|DrawTextEx|DrawTextRec|MeasureText|MeasureTextEx|GuiPanel|GuiLabel|GuiButton|GuiCheckBox|GuiSlider|GuiProgressBar|DrawCircleLines|DrawPoly|DrawPolyLines|DrawTriangleLines|DrawTexture|DrawModel|EndDrawing|CloseWindow|LoadModel|LoadImage|LoadTexture|LoadTextureFromImage|UnloadImage|UnloadModel|UnloadAll|UnloadTexture|SetCamera)\b|\b(?:Key|Camera3D|Color|Vector2|Vector3|Image|MouseButton)\b|\b\d+(?:\.\d+)?f?\b)/g;
  let result = "";
  let lastIndex = 0;
  for (const match of source.matchAll(tokenPattern)) {
    result += escapeHtml(source.slice(lastIndex, match.index));
    const token = match[0];
    let style = "";
    if (token.startsWith("//")) style = "syntax-comment";
    else if (token.startsWith('"')) style = "syntax-string";
    else if (/^\d/.test(token)) style = "syntax-number";
    else if (token.startsWith("#") || /^(int|float|bool|const|auto|while|if|return|static_cast)$/.test(token)) style = "syntax-key";
    else if (/^(Key|Camera3D|Color|Vector2|Vector3|Image|MouseButton)$/.test(token)) style = "syntax-type";
    else style = "syntax-fn";
    result += `<span class="${style}">${escapeHtml(token)}</span>`;
    lastIndex = match.index + token.length;
  }
  return result + escapeHtml(source.slice(lastIndex));
}

function setExample(name) {
  const example = examples[name];
  if (!example) return;
  const code = document.querySelector("#example-code");
  code.textContent = example.code;
  code.innerHTML = highlightCpp(example.code);
  document.querySelector("#example-filename").textContent = example.filename;
  document.querySelector("#example-description").textContent = example.description;
}

document.querySelectorAll(".example-tab").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".example-tab").forEach((tab) => {
      const active = tab === button;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    setExample(button.dataset.example);
  });
});

document.querySelectorAll("[data-copy]").forEach((button) => {
  button.addEventListener("click", async () => {
    const target = document.getElementById(button.dataset.copy);
    const text = target?.textContent;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      button.classList.add("is-copied");
      const oldLabel = button.textContent;
      button.textContent = "COPIED";
      window.setTimeout(() => {
        button.textContent = oldLabel;
        button.classList.remove("is-copied");
      }, 1400);
    } catch {
      button.textContent = "SELECT & COPY";
      window.setTimeout(() => { button.textContent = "COPY CODE"; }, 1600);
    }
  });
});

const menuToggle = document.querySelector(".menu-toggle");
const siteNav = document.querySelector(".site-nav");
menuToggle.addEventListener("click", () => {
  const expanded = menuToggle.getAttribute("aria-expanded") === "true";
  menuToggle.setAttribute("aria-expanded", String(!expanded));
  siteNav.classList.toggle("is-open", !expanded);
});

siteNav.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    menuToggle.setAttribute("aria-expanded", "false");
    siteNav.classList.remove("is-open");
  });
});

setExample("loop");
