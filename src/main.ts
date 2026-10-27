import "./style.css";
import { insectForLocation } from "./insects/registry";
import { mountInsectCursor } from "./overlay";

mountInsectCursor({ insect: insectForLocation() });
